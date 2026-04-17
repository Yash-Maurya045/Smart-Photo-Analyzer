"""
Smart Photo Analyzer - Flask Backend
=====================================
Main application entry point.
Routes: /upload, /analyze, /health
"""

import os
import uuid
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from model import AestheticScorer
from utils import (
    analyze_composition,
    analyze_lighting,
    analyze_sharpness,
    generate_suggestions,
    get_image_metadata,
)

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)
logger = logging.getLogger(__name__)

# ── App Config ─────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "..", "uploads")
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "bmp", "tiff"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Initialize ML Model (lazy-loaded on first request) ─────────────────────────
scorer: AestheticScorer = None


def get_scorer() -> AestheticScorer:
    global scorer
    if scorer is None:
        logger.info("Initialising AestheticScorer …")
        scorer = AestheticScorer()
        logger.info("AestheticScorer ready.")
    return scorer


# ── Helpers ────────────────────────────────────────────────────────────────────
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Simple health-check endpoint."""
    return jsonify({"status": "ok", "message": "Smart Photo Analyzer API is running"}), 200


@app.route("/upload", methods=["POST"])
def upload():
    """
    Accept an image upload.

    Returns:
        JSON { file_id, filename, message }
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    # Generate unique ID so concurrent uploads don't collide
    file_id = str(uuid.uuid4())
    ext = file.filename.rsplit(".", 1)[1].lower()
    safe_name = f"{file_id}.{ext}"
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_name)

    file.save(save_path)
    logger.info("Saved upload → %s", save_path)

    return jsonify({
        "file_id": file_id,
        "filename": safe_name,
        "message": "File uploaded successfully",
    }), 200


@app.route("/analyze/<file_id>", methods=["GET"])
def analyze(file_id: str):
    """
    Run full analysis pipeline on a previously uploaded image.

    Returns:
        JSON with scores and suggestions.
    """
    # Locate the file (may be jpg/png/etc)
    image_path = _find_upload(file_id)
    if image_path is None:
        return jsonify({"error": "File not found. Please upload first."}), 404

    try:
        sc = get_scorer()

        # ── 1. Aesthetic Score ──────────────────────────────────────────────
        aesthetic_result = sc.predict(image_path)

        # ── 2. CV Analyses ─────────────────────────────────────────────────
        composition_result = analyze_composition(image_path)
        lighting_result    = analyze_lighting(image_path)
        sharpness_result   = analyze_sharpness(image_path)
        metadata           = get_image_metadata(image_path)

        # ── 3. Generate Smart Suggestions ──────────────────────────────────
        suggestions = generate_suggestions(
            aesthetic_score  = aesthetic_result["score"],
            composition      = composition_result,
            lighting         = lighting_result,
            sharpness        = sharpness_result,
        )

        response = {
            "file_id": file_id,
            "metadata": metadata,
            "aesthetic": aesthetic_result,
            "composition": composition_result,
            "lighting": lighting_result,
            "sharpness": sharpness_result,
            "suggestions": suggestions,
            # Flattened convenience fields for the UI
            "aesthetic_score":   round(aesthetic_result["score"], 2),
            "composition_score": round(composition_result["score"], 2),
            "lighting_score":    round(lighting_result["score"], 2),
            "sharpness_score":   round(sharpness_result["score"], 2),
        }

        logger.info("Analysis complete for %s | Aesthetic=%.2f", file_id, aesthetic_result["score"])
        return jsonify(response), 200

    except Exception as exc:
        logger.exception("Analysis failed for %s", file_id)
        return jsonify({"error": str(exc)}), 500


@app.route("/image/<file_id>", methods=["GET"])
def serve_image(file_id: str):
    """Serve the uploaded image back to the frontend."""
    image_path = _find_upload(file_id)
    if image_path is None:
        return jsonify({"error": "Image not found"}), 404

    directory = os.path.dirname(image_path)
    filename  = os.path.basename(image_path)
    return send_from_directory(directory, filename)


# ── Internal Helpers ───────────────────────────────────────────────────────────

def _find_upload(file_id: str):
    """Return full path of uploaded file matching file_id, or None."""
    folder = app.config["UPLOAD_FOLDER"]
    for fname in os.listdir(folder):
        if fname.startswith(file_id):
            return os.path.join(folder, fname)
    return None


# ── Entry Point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("Starting Smart Photo Analyzer API on http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
