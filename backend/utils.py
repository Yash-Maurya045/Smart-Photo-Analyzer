"""
Smart Photo Analyzer – CV Utilities
=====================================
All classical computer-vision analyses:
  • Composition (Rule of Thirds + saliency)
  • Lighting (exposure, histogram)
  • Sharpness (Laplacian variance)
  • Smart suggestions engine
  • Image metadata extractor
"""

from __future__ import annotations

import os
import logging
import numpy as np
import cv2
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
#  COMPOSITION ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_composition(image_path: str) -> dict:
    """
    Rule-of-thirds composition analysis.

    Algorithm:
      1. Detect salient / dominant subject via edge + contour analysis.
      2. Find subject centroid.
      3. Measure distance from nearest rule-of-thirds intersection.
      4. Evaluate balance: left-right & top-bottom weight distribution.
      5. Compute final score.

    Returns:
        {
            score, label, subject_detected,
            subject_position: {cx_pct, cy_pct},
            nearest_intersection: {ix_pct, iy_pct},
            distance_pct,
            balance: {horizontal, vertical},
            grid_lines: {h1, h2, v1, v2},   # pixel coords for overlay
            details: {...}
        }
    """
    img = _load(image_path)
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Grid lines (pixel coords)
    v1, v2 = w // 3, 2 * w // 3
    h1, h2 = h // 3, 2 * h // 3

    # ── Subject detection via saliency-proxy (edges + largest contour) ────────
    blurred  = cv2.GaussianBlur(gray, (5, 5), 0)
    edges    = cv2.Canny(blurred, 30, 100)
    dilated  = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    subject_detected = False
    cx_pct = cy_pct = 0.5  # default: centre

    if contours:
        # Pick largest contour by area
        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        if area > (h * w * 0.005):  # at least 0.5 % of frame
            M = cv2.moments(largest)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                cx_pct = cx / w
                cy_pct = cy / h
                subject_detected = True

    # ── Rule-of-thirds intersections ──────────────────────────────────────────
    intersections = [
        (1/3, 1/3), (2/3, 1/3),
        (1/3, 2/3), (2/3, 2/3),
    ]
    distances = [
        np.sqrt((cx_pct - ix) ** 2 + (cy_pct - iy) ** 2)
        for ix, iy in intersections
    ]
    min_dist  = min(distances)
    best_idx  = int(np.argmin(distances))
    best_ix, best_iy = intersections[best_idx]

    # ── Balance analysis ──────────────────────────────────────────────────────
    left_weight  = float(gray[:, :w//2].mean())
    right_weight = float(gray[:, w//2:].mean())
    top_weight   = float(gray[:h//2, :].mean())
    bot_weight   = float(gray[h//2:, :].mean())

    h_balance = 1 - abs(left_weight - right_weight) / 255
    v_balance = 1 - abs(top_weight - bot_weight) / 255

    # ── Score calculation ─────────────────────────────────────────────────────
    # Max meaningful distance from intersection ≈ 0.47 (corner to centre)
    max_dist      = 0.47
    proximity_s   = np.clip(1 - min_dist / max_dist, 0, 1) * 10
    balance_s     = (h_balance + v_balance) / 2 * 10

    # Weight: 60 % proximity, 40 % balance
    score = 0.60 * proximity_s + 0.40 * balance_s
    score = float(np.clip(score, 0, 10))

    label = _score_label(score)

    return {
        "score":               round(score, 2),
        "label":               label,
        "subject_detected":    subject_detected,
        "subject_position":    {"cx_pct": round(cx_pct, 3), "cy_pct": round(cy_pct, 3)},
        "nearest_intersection": {"ix_pct": round(best_ix, 3), "iy_pct": round(best_iy, 3)},
        "distance_pct":        round(min_dist * 100, 2),
        "balance":             {
            "horizontal": round(h_balance, 3),
            "vertical":   round(v_balance, 3),
        },
        "grid_lines": {"h1": h1, "h2": h2, "v1": v1, "v2": v2, "W": w, "H": h},
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  LIGHTING ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_lighting(image_path: str) -> dict:
    """
    Exposure and lighting quality analysis.

    Returns:
        {
            score, label, exposure_label,
            mean_brightness, std_brightness,
            highlight_clipping_pct, shadow_clipping_pct,
            histogram: { bins, counts }   # 32-bucket histogram for UI chart
        }
    """
    img  = _load(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)

    mean_b = float(gray.mean())
    std_b  = float(gray.std())

    # Clipping
    highlight_clip = float((gray >= 250).mean() * 100)   # % blown highlights
    shadow_clip    = float((gray <= 5).mean() * 100)     # % crushed shadows

    # Exposure label
    if mean_b < 60:
        exposure_label = "Severely Underexposed"
        base_score     = 2.0
    elif mean_b < 90:
        exposure_label = "Underexposed"
        base_score     = 5.0
    elif mean_b > 200:
        exposure_label = "Severely Overexposed"
        base_score     = 2.0
    elif mean_b > 170:
        exposure_label = "Overexposed"
        base_score     = 5.0
    else:
        exposure_label = "Balanced"
        base_score     = 9.5

    # Penalise clipping
    clip_penalty = (highlight_clip + shadow_clip) * 0.15
    score        = float(np.clip(base_score - clip_penalty, 0, 10))

    # Reward good tonal spread (high std = good dynamic range)
    if exposure_label == "Balanced":
        tone_bonus = np.clip((std_b - 30) / 50 * 1.5, 0, 1.5)
        score      = float(np.clip(score + tone_bonus, 0, 10))

    label = _score_label(score)

    # Histogram (32 buckets) for sparkline/bar chart in UI
    hist, edges = np.histogram(gray.flatten(), bins=32, range=(0, 255))
    hist_norm   = (hist / hist.max()).tolist() if hist.max() > 0 else hist.tolist()

    return {
        "score":                  round(score, 2),
        "label":                  label,
        "exposure_label":         exposure_label,
        "mean_brightness":        round(mean_b, 2),
        "std_brightness":         round(std_b, 2),
        "highlight_clipping_pct": round(highlight_clip, 2),
        "shadow_clipping_pct":    round(shadow_clip, 2),
        "histogram": {
            "bins":   [round(float(e), 1) for e in edges[:-1]],
            "counts": [round(float(c), 4) for c in hist_norm],
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  SHARPNESS ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_sharpness(image_path: str) -> dict:
    """
    Sharpness / blur detection using Laplacian variance.

    Also checks motion blur direction using gradient orientation.

    Returns:
        {
            score, label, laplacian_variance,
            is_blurry, blur_type
        }
    """
    img  = _load(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # Score mapping (empirically tuned):
    # lap_var < 50   → very blurry (score ≈ 1–3)
    # lap_var 50–200 → somewhat blurry (score 3–6)
    # lap_var 200–800 → acceptable (score 6–8)
    # lap_var > 800  → sharp (score 8–10)
    if lap_var < 50:
        score = 1.0 + (lap_var / 50) * 2
    elif lap_var < 200:
        score = 3.0 + ((lap_var - 50) / 150) * 3
    elif lap_var < 800:
        score = 6.0 + ((lap_var - 200) / 600) * 2
    else:
        score = 8.0 + np.clip((lap_var - 800) / 2000 * 2, 0, 2)

    score     = float(np.clip(score, 1, 10))
    is_blurry = lap_var < 200

    # Detect motion vs defocus blur
    if is_blurry:
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        ratio  = float(np.abs(sobelx).mean() / (np.abs(sobely).mean() + 1e-6))
        if ratio > 2.5:
            blur_type = "Horizontal Motion Blur"
        elif ratio < 0.4:
            blur_type = "Vertical Motion Blur"
        else:
            blur_type = "Defocus / Out-of-Focus"
    else:
        blur_type = "None"

    label = _score_label(score)

    return {
        "score":               round(score, 2),
        "label":               label,
        "laplacian_variance":  round(lap_var, 2),
        "is_blurry":           is_blurry,
        "blur_type":           blur_type,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  SMART SUGGESTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_suggestions(
    aesthetic_score: float,
    composition: dict,
    lighting: dict,
    sharpness: dict,
) -> list[dict]:
    """
    Generate prioritised, actionable photography suggestions.

    Returns:
        List of { icon, title, detail, priority }
    """
    tips: list[dict] = []

    # ── Sharpness ─────────────────────────────────────────────────────────────
    if sharpness["is_blurry"]:
        blur_type = sharpness.get("blur_type", "")
        if "Motion" in blur_type:
            tips.append({
                "icon": "⚡",
                "title": "Increase Shutter Speed",
                "detail": f"Motion blur detected ({blur_type}). Use a faster shutter speed or enable OIS/IBIS.",
                "priority": 1,
                "category": "sharpness",
            })
        else:
            tips.append({
                "icon": "🎯",
                "title": "Improve Focus",
                "detail": "The image appears out-of-focus. Use AF-point lock on your subject or increase depth of field.",
                "priority": 1,
                "category": "sharpness",
            })

    # ── Lighting ───────────────────────────────────────────────────────────────
    exp = lighting.get("exposure_label", "")
    if "Underexposed" in exp:
        severity = "significantly" if "Severely" in exp else "slightly"
        tips.append({
            "icon": "☀️",
            "title": f"Increase Exposure {severity.title()}",
            "detail": f"Image is {exp.lower()}. Raise EV compensation by +{1 if 'slightly' in severity else 2} stop(s) or open the aperture.",
            "priority": 1 if "Severely" in exp else 2,
            "category": "lighting",
        })
    elif "Overexposed" in exp:
        severity = "significantly" if "Severely" in exp else "slightly"
        tips.append({
            "icon": "🌙",
            "title": f"Reduce Exposure {severity.title()}",
            "detail": f"Highlights are blown ({lighting['highlight_clipping_pct']:.1f}% clipped). Lower EV or use a graduated ND filter.",
            "priority": 1 if "Severely" in exp else 2,
            "category": "lighting",
        })

    if lighting.get("shadow_clipping_pct", 0) > 5:
        tips.append({
            "icon": "🖤",
            "title": "Lift Shadow Detail",
            "detail": f"{lighting['shadow_clipping_pct']:.1f}% of pixels are crushed to black. Apply fill light or raise shadow slider in post.",
            "priority": 2,
            "category": "lighting",
        })

    # ── Composition ────────────────────────────────────────────────────────────
    dist = composition.get("distance_pct", 0)
    if dist > 15:  # subject > 15 % away from nearest intersection
        pos = composition.get("subject_position", {})
        cx  = pos.get("cx_pct", 0.5)
        ni  = composition.get("nearest_intersection", {})
        direction = _reframe_direction(cx, ni.get("ix_pct", 0.5))
        tips.append({
            "icon": "⚖️",
            "title": f"Reframe Subject {direction}",
            "detail": (
                f"Subject is {dist:.0f}% away from the nearest rule-of-thirds intersection. "
                f"Move it {direction.lower()} to strengthen visual impact."
            ),
            "priority": 2,
            "category": "composition",
        })

    bal = composition.get("balance", {})
    if bal.get("horizontal", 1) < 0.7:
        tips.append({
            "icon": "↔️",
            "title": "Balance Horizontal Tones",
            "detail": "Left and right halves have significantly different luminosity. Consider repositioning your light source or subject.",
            "priority": 3,
            "category": "composition",
        })

    # ── Overall Aesthetic ──────────────────────────────────────────────────────
    if aesthetic_score < 5:
        tips.append({
            "icon": "🎨",
            "title": "Review Overall Composition",
            "detail": "The overall aesthetic score is low. Consider all of the above and revisit your creative intent.",
            "priority": 3,
            "category": "aesthetic",
        })
    elif aesthetic_score >= 8:
        tips.append({
            "icon": "⭐",
            "title": "Excellent Shot!",
            "detail": "This image scores highly on aesthetic quality. Minor post-processing may push it further.",
            "priority": 5,
            "category": "aesthetic",
        })
    else:
        tips.append({
            "icon": "✨",
            "title": "Good Foundation",
            "detail": "Solid image with room for improvement. Address the suggestions above to elevate the shot.",
            "priority": 4,
            "category": "aesthetic",
        })

    # General tips if image is already good but could improve
    if aesthetic_score >= 6 and sharpness["score"] >= 7 and not sharpness["is_blurry"]:
        tips.append({
            "icon": "🎞️",
            "title": "Consider Colour Grading",
            "detail": "Technical quality is solid. A cohesive colour grade or LUT can make the image truly memorable.",
            "priority": 4,
            "category": "post_processing",
        })

    # Sort by priority
    tips.sort(key=lambda t: t["priority"])
    return tips


# ═══════════════════════════════════════════════════════════════════════════════
#  IMAGE METADATA
# ═══════════════════════════════════════════════════════════════════════════════

def get_image_metadata(image_path: str) -> dict:
    """Return basic file and image metadata."""
    img  = _load(image_path)
    h, w = img.shape[:2]
    channels = img.shape[2] if img.ndim == 3 else 1
    size_kb  = os.path.getsize(image_path) / 1024

    return {
        "width":      w,
        "height":     h,
        "channels":   channels,
        "aspect_ratio": round(w / h, 3),
        "size_kb":    round(size_kb, 1),
        "megapixels": round(w * h / 1_000_000, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  INTERNAL HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _load(image_path: str) -> np.ndarray:
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Cannot open image: {image_path}")
    # Resize very large images for speed (keep aspect ratio)
    h, w = img.shape[:2]
    if max(h, w) > 1600:
        scale = 1600 / max(h, w)
        img   = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def _score_label(score: float) -> str:
    if score >= 8.5:  return "Exceptional"
    if score >= 7.0:  return "Great"
    if score >= 5.5:  return "Good"
    if score >= 4.0:  return "Fair"
    return "Needs Improvement"


def _reframe_direction(cx_pct: float, target_pct: float) -> str:
    diff = target_pct - cx_pct
    if abs(diff) < 0.05:
        return "Slightly"
    return "to the Right" if diff > 0 else "to the Left"
