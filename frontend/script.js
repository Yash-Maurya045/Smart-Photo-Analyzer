/* ════════════════════════════════════════════════════════════════════════════
   Smart Photo Analyzer – Frontend Logic
   ════════════════════════════════════════════════════════════════════════════
   Sections:
     1. Config & State
     2. Particle Background
     3. Upload Handling
     4. Analysis Pipeline
     5. Results Rendering
     6. Histogram & Composition Canvas
     7. Report Download
     8. Utility Functions
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ── 1. Config & State ────────────────────────────────────────────────────── */

const API_BASE = 'http://localhost:5000';

const state = {
  fileId:      null,
  filename:    null,
  analysisData: null,
  gridVisible: false,
};

/* ── 2. Particle Background ───────────────────────────────────────────────── */

(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  const ctx    = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * canvas.width;
      this.y  = Math.random() * canvas.height;
      this.r  = Math.random() * 1.2 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.15;
      this.vy = (Math.random() - 0.5) * 0.15;
      this.life = Math.random();
      this.maxLife = 0.4 + Math.random() * 0.6;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.life += 0.002;
      if (this.life > this.maxLife) this.reset();
    }
    draw() {
      const alpha = Math.sin((this.life / this.maxLife) * Math.PI) * 0.4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201,168,76,${alpha})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 90; i++) particles.push(new Particle());

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(frame);
  }
  frame();
})();

/* ── 3. Upload Handling ───────────────────────────────────────────────────── */

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('upload-zone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file.', 'error');
    return;
  }
  if (file.size > 16 * 1024 * 1024) {
    showToast('File too large. Maximum size is 16 MB.', 'error');
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('upload-zone').style.display = 'none';
    document.getElementById('preview-section').style.display = 'block';
    document.getElementById('preview-meta').textContent =
      `${file.name}  ·  ${(file.size / 1024).toFixed(1)} KB  ·  ${file.type}`;
  };
  reader.readAsDataURL(file);

  // Upload to backend
  uploadFile(file);
}

async function uploadFile(file) {
  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Uploading…';

  const fd = new FormData();
  fd.append('file', file);

  try {
    const res  = await fetch(`${API_BASE}/upload`, { method: 'POST', body: fd });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Upload failed');

    state.fileId   = data.file_id;
    state.filename = data.filename;

    btn.disabled = false;
    btn.querySelector('span').textContent = 'Run AI Analysis';
    showToast('Upload successful! Ready to analyze.', 'success');
  } catch (err) {
    console.error(err);
    // Demo mode: use a fake fileId so UX still works
    state.fileId = '__demo__';
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Run AI Analysis (Demo)';
    showToast('Backend offline – running in demo mode.', 'info');
  }
}

function resetUpload() {
  state.fileId = null;
  document.getElementById('upload-zone').style.display = '';
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('file-input').value = '';
}

function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  const overlay = document.getElementById('grid-overlay');
  const btn     = document.getElementById('grid-toggle');
  overlay.classList.toggle('visible', state.gridVisible);
  btn.classList.toggle('active', state.gridVisible);
}

/* ── 4. Analysis Pipeline ─────────────────────────────────────────────────── */

async function runAnalysis() {
  if (!state.fileId) { showToast('Please upload an image first.', 'error'); return; }

  // Show loading, hide results
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('results-section').style.display  = 'none';
  document.getElementById('loading-section').style.display  = 'flex';

  // Animate loading steps
  const steps = document.querySelectorAll('.lstep');
  let stepIdx = 0;
  const stepTimer = setInterval(() => {
    if (stepIdx > 0) steps[stepIdx - 1].classList.replace('active', 'done');
    if (stepIdx < steps.length) { steps[stepIdx].classList.add('active'); stepIdx++; }
    else clearInterval(stepTimer);
  }, 600);

  try {
    let data;
    if (state.fileId === '__demo__') {
      await sleep(3000);
      data = generateDemoData();
    } else {
      const res = await fetch(`${API_BASE}/analyze/${state.fileId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Analysis failed');
      }
      data = await res.json();
    }

    clearInterval(stepTimer);
    steps.forEach(s => s.classList.remove('active'));
    steps[steps.length - 1].classList.add('done');

    await sleep(500);

    state.analysisData = data;
    renderResults(data);

    document.getElementById('loading-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error(err);
    clearInterval(stepTimer);
    document.getElementById('loading-section').style.display = 'none';
    document.getElementById('preview-section').style.display = 'block';
    showToast(`Analysis error: ${err.message}`, 'error');
  }
}

/* ── 5. Results Rendering ─────────────────────────────────────────────────── */

function renderResults(data) {
  const ae = data.aesthetic_score;
  const co = data.composition_score;
  const li = data.lighting_score;
  const sh = data.sharpness_score;

  // Headline
  const label = data.aesthetic?.label || scoreLabel(ae);
  document.getElementById('results-headline').textContent = `${label} Photography`;
  document.getElementById('results-subtitle').textContent =
    `Overall aesthetic score: ${ae}/10 · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  // ── Aesthetic Ring ─────────────────────────────────────────────────────────
  const ring  = document.getElementById('ring-aesthetic');
  const circumference = 2 * Math.PI * 50; // r=50
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = circumference - (ae / 10) * circumference;
  });
  animateNumber('score-aesthetic', 0, ae, 1200, 1);
  document.getElementById('label-aesthetic').textContent = label;
  document.getElementById('confidence-aesthetic').textContent =
    data.aesthetic?.confidence ? `Confidence: ${Math.round(data.aesthetic.confidence * 100)}%` : '';

  applyScoreColour('card-aesthetic', ae, 'ring-fill');

  // ── Mini Scores ────────────────────────────────────────────────────────────
  renderMini('composition', co, data.composition?.label || scoreLabel(co));
  renderMini('lighting',    li, data.lighting?.label    || scoreLabel(li));
  renderMini('sharpness',   sh, data.sharpness?.label   || scoreLabel(sh));

  // ── Detail: Lighting histogram ─────────────────────────────────────────────
  if (data.lighting?.histogram) drawHistogram(data.lighting.histogram, data.lighting.exposure_label);
  document.getElementById('exposure-badge').textContent = data.lighting?.exposure_label || '';

  const ls = document.getElementById('lighting-stats');
  ls.innerHTML = [
    statPill('Brightness', data.lighting?.mean_brightness?.toFixed(1) ?? '–'),
    statPill('Std Dev',    data.lighting?.std_brightness?.toFixed(1) ?? '–'),
    statPill('Hi Clip',   (data.lighting?.highlight_clipping_pct ?? 0).toFixed(1) + '%'),
    statPill('Sh Clip',   (data.lighting?.shadow_clipping_pct ?? 0).toFixed(1) + '%'),
  ].join('');

  // ── Detail: Composition canvas ─────────────────────────────────────────────
  drawCompositionCanvas(data.composition);
  const cs = document.getElementById('composition-stats');
  cs.innerHTML = [
    statPill('Subject Detected', data.composition?.subject_detected ? 'Yes' : 'No'),
    statPill('H-Balance', ((data.composition?.balance?.horizontal ?? 0) * 100).toFixed(0) + '%'),
    statPill('V-Balance', ((data.composition?.balance?.vertical   ?? 0) * 100).toFixed(0) + '%'),
    statPill('Dist to Grid', (data.composition?.distance_pct ?? 0).toFixed(1) + '%'),
  ].join('');

  // ── Detail: Sharpness gauge ────────────────────────────────────────────────
  const gauge = document.getElementById('sharpness-gauge');
  gauge.style.setProperty('--gauge-w', `${sh * 10}%`);
  const ss = document.getElementById('sharpness-stats');
  ss.innerHTML = [
    statPill('Laplacian Var', data.sharpness?.laplacian_variance?.toFixed(1) ?? '–'),
    statPill('Blur Type',     data.sharpness?.blur_type || 'None'),
    statPill('Is Blurry',     data.sharpness?.is_blurry ? '⚠ Yes' : '✓ No'),
  ].join('');

  // ── Suggestions ────────────────────────────────────────────────────────────
  renderSuggestions(data.suggestions || []);

  // ── Metadata strip ─────────────────────────────────────────────────────────
  const m    = data.metadata || {};
  const meta = document.getElementById('meta-strip');
  meta.innerHTML = [
    metaItem('Dimensions', `${m.width ?? '–'} × ${m.height ?? '–'} px`),
    metaItem('Megapixels', m.megapixels ?? '–'),
    metaItem('Aspect',     m.aspect_ratio ?? '–'),
    metaItem('File Size',  m.size_kb ? m.size_kb + ' KB' : '–'),
    metaItem('Mode',       data.aesthetic?.mode || '–'),
  ].join('');
}

function renderMini(id, score, label) {
  document.getElementById(`score-${id}`).textContent = score.toFixed(1);
  document.getElementById(`label-${id}`).textContent = label;
  setTimeout(() => {
    document.getElementById(`bar-${id}`).style.width = `${score * 10}%`;
  }, 100);
  applyScoreColour(`card-${id}`, score);
}

function applyScoreColour(cardId, score) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.remove('score-high', 'score-low');
  if (score >= 7.5)      card.classList.add('score-high');
  else if (score < 4.5)  card.classList.add('score-low');
}

function renderSuggestions(tips) {
  const grid = document.getElementById('suggestions-grid');
  grid.innerHTML = '';
  tips.forEach((tip, i) => {
    const card = document.createElement('div');
    card.className = 'suggestion-card';
    card.style.animationDelay = `${i * 80}ms`;
    card.innerHTML = `
      <div class="suggestion-icon">${tip.icon}</div>
      <div class="suggestion-body">
        <div class="suggestion-title">${tip.title}</div>
        <div class="suggestion-detail">${tip.detail}</div>
        <span class="suggestion-cat cat-${tip.category}">${tip.category.replace('_', ' ')}</span>
      </div>`;
    grid.appendChild(card);
  });
}

/* ── 6. Canvas Visualizations ─────────────────────────────────────────────── */

function drawHistogram(hist, exposureLabel) {
  const canvas = document.getElementById('histogram-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const counts = hist.counts;
  const N      = counts.length;
  const barW   = W / N;

  counts.forEach((v, i) => {
    const x = i * barW;
    const h = v * (H - 4);

    // Colour zones: shadows (blue), midtones (gold), highlights (white)
    const pct = i / N;
    let r, g, b;
    if (pct < 0.33) {
      r = 60;  g = 80;  b = 180;
    } else if (pct < 0.66) {
      r = 201; g = 168; b = 76;
    } else {
      r = 220; g = 210; b = 190;
    }

    // Highlight clipping
    if (i > N * 0.92 && v > 0.7) r = 232, g = 75, b = 75;

    ctx.fillStyle = `rgba(${r},${g},${b},0.75)`;
    ctx.fillRect(x, H - h, barW - 1, h);
  });

  // Exposure indicator line
  const mean = hist.bins?.length > 0 ? hist.bins[Math.round(N / 2)] : 128;
}

function drawCompositionCanvas(comp) {
  const canvas = document.getElementById('comp-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#141720';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(201,168,76,0.3)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  [W/3, 2*W/3].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); });
  [H/3, 2*H/3].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
  ctx.setLineDash([]);

  // Intersection points
  ctx.fillStyle = 'rgba(201,168,76,0.6)';
  [[W/3,H/3],[2*W/3,H/3],[W/3,2*H/3],[2*W/3,2*H/3]].forEach(([x,y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    // Crosshair
    ctx.strokeStyle = 'rgba(201,168,76,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12); ctx.stroke();
  });

  if (!comp) return;

  // Subject position
  const pos = comp.subject_position || {};
  const sx  = (pos.cx_pct || 0.5) * W;
  const sy  = (pos.cy_pct || 0.5) * H;

  // Line from subject to nearest intersection
  const ni = comp.nearest_intersection || {};
  const ix = (ni.ix_pct || 0.5) * W;
  const iy = (ni.iy_pct || 0.5) * H;

  ctx.strokeStyle = 'rgba(78,205,196,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ix, iy); ctx.stroke();
  ctx.setLineDash([]);

  // Subject dot
  const detected = comp.subject_detected;
  ctx.beginPath();
  ctx.arc(sx, sy, 10, 0, Math.PI * 2);
  ctx.fillStyle = detected ? 'rgba(78,205,196,0.25)' : 'rgba(232,75,75,0.2)';
  ctx.fill();
  ctx.strokeStyle = detected ? 'rgba(78,205,196,0.9)' : 'rgba(232,75,75,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(78,205,196,0.85)';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillText(detected ? 'Subject' : 'Centroid', sx + 14, sy + 4);

  // Distance label
  const dist = comp.distance_pct?.toFixed(1) || '–';
  ctx.fillStyle = 'rgba(201,168,76,0.7)';
  ctx.fillText(`Δ ${dist}%`, (sx + ix) / 2 + 6, (sy + iy) / 2 - 4);
}

/* ── 7. Report Download ───────────────────────────────────────────────────── */

function downloadReport() {
  const data = state.analysisData;
  if (!data) return;

  const lines = [
    '════════════════════════════════════════════════════',
    '  SMART PHOTO ANALYZER – AI AESTHETIC REPORT',
    '════════════════════════════════════════════════════',
    `  Generated: ${new Date().toLocaleString()}`,
    '',
    '── SCORES ───────────────────────────────────────────',
    `  Aesthetic Score : ${data.aesthetic_score}/10  (${data.aesthetic?.label})`,
    `  Composition     : ${data.composition_score}/10  (${data.composition?.label})`,
    `  Lighting        : ${data.lighting_score}/10  (${data.lighting?.label})`,
    `  Sharpness       : ${data.sharpness_score}/10  (${data.sharpness?.label})`,
    '',
    '── LIGHTING ─────────────────────────────────────────',
    `  Exposure        : ${data.lighting?.exposure_label}`,
    `  Mean Brightness : ${data.lighting?.mean_brightness}`,
    `  Highlight Clip  : ${data.lighting?.highlight_clipping_pct}%`,
    `  Shadow Clip     : ${data.lighting?.shadow_clipping_pct}%`,
    '',
    '── COMPOSITION ──────────────────────────────────────',
    `  Subject Detected: ${data.composition?.subject_detected}`,
    `  Dist to Grid    : ${data.composition?.distance_pct}%`,
    `  H-Balance       : ${(data.composition?.balance?.horizontal * 100)?.toFixed(1)}%`,
    `  V-Balance       : ${(data.composition?.balance?.vertical * 100)?.toFixed(1)}%`,
    '',
    '── SHARPNESS ────────────────────────────────────────',
    `  Laplacian Var   : ${data.sharpness?.laplacian_variance}`,
    `  Blur Type       : ${data.sharpness?.blur_type}`,
    `  Is Blurry       : ${data.sharpness?.is_blurry}`,
    '',
    '── METADATA ─────────────────────────────────────────',
    `  Dimensions      : ${data.metadata?.width} × ${data.metadata?.height} px`,
    `  Megapixels      : ${data.metadata?.megapixels} MP`,
    `  File Size       : ${data.metadata?.size_kb} KB`,
    '',
    '── SUGGESTIONS ──────────────────────────────────────',
    ...(data.suggestions || []).map((s, i) => `  ${i + 1}. ${s.title}\n     ${s.detail}`),
    '',
    '════════════════════════════════════════════════════',
    '  Smart Photo Analyzer · AI Aesthetic Intelligence',
    '════════════════════════════════════════════════════',
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `photo-analysis-report-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Report downloaded!', 'success');
}

/* ── 8. Utility Functions ─────────────────────────────────────────────────── */

function resetAll() {
  state.fileId       = null;
  state.analysisData = null;
  state.gridVisible  = false;
  document.getElementById('file-input').value = '';
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('upload-zone').style.display      = '';
  document.getElementById('grid-overlay').classList.remove('visible');
  document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' });
}

function animateNumber(elemId, from, to, duration, decimals) {
  const el    = document.getElementById(elemId);
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const v = from + (to - from) * easeOutCubic(t);
    el.textContent = v.toFixed(decimals);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function sleep(ms)        { return new Promise(r => setTimeout(r, ms)); }
function scoreLabel(s)    {
  if (s >= 8.5) return 'Exceptional';
  if (s >= 7.0) return 'Great';
  if (s >= 5.5) return 'Good';
  if (s >= 4.0) return 'Fair';
  return 'Needs Improvement';
}
function statPill(label, value) {
  return `<div class="stat-pill"><strong>${label}</strong> ${value}</div>`;
}
function metaItem(label, value) {
  return `<span class="meta-item"><strong>${label}:</strong> ${value}</span>`;
}

let toastTimer;
function showToast(msg, type = 'info') {
  let toast = document.getElementById('__toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '__toast';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '32px', right: '32px',
      padding: '14px 22px', borderRadius: '12px',
      fontFamily: 'DM Sans, sans-serif', fontSize: '14px',
      zIndex: '9999', transition: 'all 0.3s ease',
      backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)',
      maxWidth: '360px', lineHeight: '1.4',
    });
    document.body.appendChild(toast);
  }
  const colours = {
    success: { bg: 'rgba(78,205,196,0.15)', border: 'rgba(78,205,196,0.3)', color: '#4ecdc4' },
    error:   { bg: 'rgba(232,75,75,0.15)',  border: 'rgba(232,75,75,0.3)', color: '#e84b4b' },
    info:    { bg: 'rgba(201,168,76,0.1)',  border: 'rgba(201,168,76,0.25)', color: '#c9a84c' },
  };
  const c = colours[type] || colours.info;
  toast.style.background   = c.bg;
  toast.style.borderColor  = c.border;
  toast.style.color        = c.color;
  toast.textContent        = msg;
  toast.style.opacity      = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

/* ── Demo Data (used when backend is offline) ─────────────────────────────── */

function generateDemoData() {
  return {
    file_id: '__demo__',
    aesthetic_score:   7.6,
    composition_score: 6.8,
    lighting_score:    5.2,
    sharpness_score:   8.9,
    aesthetic: {
      score: 7.6, confidence: 0.82, label: 'Great', mode: 'demo',
    },
    composition: {
      score: 6.8, label: 'Good', subject_detected: true,
      subject_position:    { cx_pct: 0.42, cy_pct: 0.38 },
      nearest_intersection:{ ix_pct: 0.333, iy_pct: 0.333 },
      distance_pct: 10.4,
      balance: { horizontal: 0.81, vertical: 0.74 },
    },
    lighting: {
      score: 5.2, label: 'Fair', exposure_label: 'Underexposed',
      mean_brightness: 82, std_brightness: 51,
      highlight_clipping_pct: 0.4, shadow_clipping_pct: 3.2,
      histogram: {
        bins: Array.from({length:32}, (_,i) => i * 8),
        counts: [0.85,0.72,0.64,0.58,0.50,0.43,0.38,0.33,0.29,0.26,0.24,0.22,0.20,0.19,0.18,0.17,
                 0.16,0.15,0.14,0.14,0.13,0.13,0.12,0.12,0.10,0.09,0.07,0.06,0.05,0.04,0.02,0.01],
      },
    },
    sharpness: {
      score: 8.9, label: 'Exceptional', laplacian_variance: 942.3,
      is_blurry: false, blur_type: 'None',
    },
    metadata: {
      width: 4032, height: 3024, channels: 3,
      aspect_ratio: 1.333, size_kb: 3840.5, megapixels: 12.19,
    },
    suggestions: [
      {
        icon: '☀️', title: 'Increase Exposure',
        detail: 'Image is underexposed. Raise EV compensation by +1 stop or open the aperture one stop.',
        priority: 2, category: 'lighting',
      },
      {
        icon: '🖤', title: 'Lift Shadow Detail',
        detail: '3.2% of pixels are crushed to black. Apply fill light or raise shadow slider in post.',
        priority: 2, category: 'lighting',
      },
      {
        icon: '⚖️', title: 'Reframe Subject to the Left',
        detail: 'Subject is 10.4% away from the nearest rule-of-thirds intersection. Moving it left improves visual impact.',
        priority: 2, category: 'composition',
      },
      {
        icon: '🎞️', title: 'Consider Colour Grading',
        detail: 'Technical quality is solid. A cohesive colour grade can make the image truly memorable.',
        priority: 4, category: 'post_processing',
      },
      {
        icon: '✨', title: 'Good Foundation',
        detail: 'Solid image with room for improvement. Addressing exposure will significantly elevate this shot.',
        priority: 4, category: 'aesthetic',
      },
    ],
  };
}
