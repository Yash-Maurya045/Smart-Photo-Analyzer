**◈ Smart Photo Analyzer**  
**AI-Powered Aesthetic Evaluation System**  
*A production-quality SaaS-style web application that analyses photographs*  
 *  
 across four AI/CV dimensions and delivers professional photography feedback.*  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OMQ2AABAAsSNBCkJfFEIwwIgHRiywEZJWQZeZ2ao9AAD+4lyruzq+ngAA8Nr1AOHsBegrsOrIAAAAAElFTkSuQmCC)  
**📸 Demo Preview**  
Aesthetic Score : 8.4 / 10  ⭐ Great  
 Composition     : 7.2 / 10  ✓  Good  
 Lighting        : 5.6 / 10  ⚠  Underexposed  
 Sharpness       : 9.0 / 10  ✓  Exceptional  
   
 Suggestions:  
   ☀️  Increase exposure by +1 stop  
   ⚖️  Reframe subject to left third  
   🎞️  Consider colour grading in post  
   
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANUlEQVR4nO3OYQ1AABSAwY8JoIGqr4Z6Eoiggn9mu0twy8wc1RkAAH9xbdVa7V9PAAB47X4A9C4EIsmYmgsAAAAASUVORK5CYII=)  
**🗂 Project Structure**  
smart-photo-analyzer/  
 ├── backend/  
 │   ├── app.py              # Flask API server (routes: /upload, /analyze/<id>, /image/<id>)  
 │   ├── model.py            # AestheticScorer (MobileNetV2 + CV heuristic fallback)  
 │   ├── utils.py            # Composition, Lighting, Sharpness, Suggestions  
 │   └── requirements.txt  
 ├── frontend/  
 │   ├── index.html          # Main UI (single-page)  
 │   ├── styles.css          # Dark luxury theme (glassmorphism + animations)  
 │   └── script.js           # Upload, analysis, visualization logic  
 ├── models/  
 │   └── aesthetic_model.h5  # (optional) place your AVA-finetuned Keras model here  
 ├── uploads/                # Temporary image storage (auto-created)  
 └── README.md  
   
   
To run —  
1. Start backend  
cd "/home/yash/Drive_E/MCA Data Science/SEM 2 MCD CU/Main Pojects/ML/files/backend"  
source venv/bin/activate  
python app.py  
2. Open frontend  
cd ../frontend  
xdg-open index.html  
   
   
   
   
   
   
   
   
   
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANUlEQVR4nO3OMQ2AABAAsSNBCUpfEJ5YGBDBgAU2QtIq6DIzW7UHAMBfHGt1V+fXEwAAXrseHDYF+yOk59sAAAAASUVORK5CYII=)  
**⚙️ Requirements**  
**System**  
- Python 3.9 – 3.12  
- Node.js not required (pure HTML/CSS/JS frontend)  
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+)  
**Python packages**  
flask >= 3.0  
 flask-cors >= 4.0  
 numpy >= 1.24  
 opencv-python >= 4.8  
 Pillow >= 10.0  
 tensorflow >= 2.14   ← optional but recommended  
   
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANUlEQVR4nO3OMQ2AABAAsSNhwgJWEPcbJpnRgQU2QtIq6DIze3UGAMBf3Gu1VcfXEwAAXrseaIkEMIPgIvAAAAAASUVORK5CYII=)  
**🚀 Quick Start**  
**1. Clone / Download**  
git clone <repo-url>  
 cd smart-photo-analyzer  
   
**2. Create a Virtual Environment**  
python -m venv venv  
 source venv/bin/activate        # Windows: venv\Scripts\activate  
   
**3. Install Dependencies**  
cd backend  
 pip install -r requirements.txt  
   
***No GPU? No problem.***  
 *  
 Comment out the * *tensorflow* * line in * *requirements.txt* * and the backend*  
 *  
 automatically falls back to a pure OpenCV heuristic scorer.*  
 *  
 Scores remain meaningful and differentiated.*  
**4. Start the Backend**  
# Inside backend/  
 python app.py  
   
You should see:  
INFO – Starting Smart Photo Analyzer API on http://0.0.0.0:5000  
 INFO – MobileNetV2 feature extractor ready (feature_heuristic mode)  
   
**5. Open the Frontend**  
Open frontend/index.html directly in your browser — **no build step needed.**  
*If you hit CORS issues serving from * *file://* *, run a quick local server:*  
*cd frontend  
 python -m http.server 8080  
 # open http://localhost:8080  
 *  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OMQ2AABAAsSNBACPiUML0NpGACyywEZJWQZeZ2aszAAD+4l6rrTq+ngAA8Nr1AL/SBEZwuCSwAAAAAElFTkSuQmCC)  
**🧠 Machine Learning Architecture**  
**Aesthetic Scoring (3-tier fallback)**  
| | | |  
|-|-|-|  
| **Priority** | **Mode** | **Description** |   
| 1 | saved_model | Loads models/aesthetic_model.h5 — an AVA-finetuned Keras model (bring your own) |   
| 2 | feature_heuristic | MobileNetV2 (ImageNet) feature extraction + weighted heuristic regression |   
| 3 | cv_heuristic | Pure OpenCV: sharpness + exposure + saturation + noise + composition energy |   
   
**Bringing Your Own AVA Model**  
1. Train a MobileNetV2/ResNet head on the [AVA dataset](https://academictorrents.com/details/71631f83b11d3d79d8f84efe0a7e12f0ac001460 "https://academictorrents.com/details/71631f83b11d3d79d8f84efe0a7e12f0ac001460")  
2. Save as models/aesthetic_model.h5 with a single sigmoid output  
3. The backend will auto-detect and use it (mode = saved_model)  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANUlEQVR4nO3OMQ2AABAAsSNBCUrfD6LYGNDAgAU2QtIq6DIzW7UHAMBfHGt1V+fXEwAAXrseHDAF/orRG+cAAAAASUVORK5CYII=)  
**🔌 API Reference**  
POST /upload  
Upload an image file.  
Request:  multipart/form-data  { "file": <image> }  
 Response: { "file_id": "uuid", "filename": "uuid.jpg", "message": "..." }  
   
GET /analyze/<file_id>  
Run full analysis pipeline.  
Response: {  
   "aesthetic_score":   8.4,  
   "composition_score": 7.2,  
   "lighting_score":    5.6,  
   "sharpness_score":   9.0,  
   "aesthetic":  { "score", "confidence", "label", "mode" },  
   "composition":{ "score", "label", "subject_detected", "subject_position",  
                   "nearest_intersection", "distance_pct", "balance", "grid_lines" },  
   "lighting":   { "score", "label", "exposure_label", "mean_brightness",  
                   "std_brightness", "highlight_clipping_pct", "shadow_clipping_pct",  
                   "histogram": { "bins", "counts" } },  
   "sharpness":  { "score", "label", "laplacian_variance", "is_blurry", "blur_type" },  
   "suggestions": [ { "icon", "title", "detail", "priority", "category" } ],  
   "metadata":   { "width", "height", "channels", "aspect_ratio", "size_kb", "megapixels" }  
 }  
   
GET /image/<file_id>  
Serve the uploaded image (for preview).  
GET /health  
Health check → { "status": "ok" }  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OMQ2AABAAsSPBCj7fFRYQwYwEZiywEZJWQZeZ2ao9AAD+4lyruzq+ngAA8Nr1AMTJBeJDClAyAAAAAElFTkSuQmCC)  
**💻 Frontend Features**  
| | |  
|-|-|  
| **Feature** | **Implementation** |   
| Particle background | Canvas API — 90 gold particles with fade lifecycle |   
| Drag & drop upload | HTML5 File API + DataTransfer |   
| Image preview | FileReader API — instant local render |   
| Rule-of-thirds overlay | CSS absolute positioning over <img> |   
| Aesthetic ring animation | SVG stroke-dashoffset transition |   
| Mini score bars | CSS width transition via JS |   
| Lighting histogram | Canvas 2D — colour-zoned bars (shadows/mids/highlights) |   
| Composition diagram | Canvas 2D — grid + subject marker + intersection lines |   
| Sharpness gauge | CSS custom property --gauge-w with gradient fill |   
| Suggestions | Staggered CSS slide-up animation cards |   
| Loading steps | Timed class swaps (active → done) |   
| Report download | Blob + URL.createObjectURL |   
| Demo mode | Auto-activates when backend is offline |   
| Responsive | CSS Grid + clamp(), collapses to 1-column on mobile |   
   
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAM0lEQVR4nO3OUQmAQBBAwSdcjsu6HYxoDsEK/okwk2COmdnVGQAAf3GtalX76wkAAK/dDxFWBDkFf6+SAAAAAElFTkSuQmCC)  
**🎨 Design System**  
Colors:  
   --bg:        #08090d   (near-black)  
   --gold:      #c9a84c   (primary accent — Cormorant gold)  
   --cyan:      #4ecdc4   (success / high scores)  
   --red:       #e84b4b   (warning / low scores)  
   
 Typography:  
   Display:     Cormorant Garamond 300 / 400 (editorial serif)  
   Body:        DM Sans 300–600 (clean grotesque)  
   Data:        JetBrains Mono 300–400 (technical readouts)  
   
 Effects:  
   Glassmorphism:  backdrop-filter: blur(20px) + rgba backgrounds  
   Score rings:    SVG stroke-dashoffset animation  
   Cards:          hover translateY(-3px) + box-shadow transition  
   Particles:      Canvas RAF loop with alpha fade lifecycle  
   
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsSfYxZo/kSGMYQLPJrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA4qrBdGuSdJuAAAAAElFTkSuQmCC)  
**🔧 Configuration**  
Edit script.js line 12 to point to your backend:  
const API_BASE = 'http://localhost:5000';   // change if deployed  
   
For production deployment:  
- Use gunicorn instead of Flask dev server  
- Add nginx as reverse proxy  
- Set UPLOAD_FOLDER to persistent storage  
- Add rate limiting to /upload and /analyze  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANElEQVR4nO3OQQmAABRAsSdYxKY/jbnMIJ7FCt5E2BJsmZmt2gMA4C+Otbqr8+sJAACvXQ85TgYRMv3/cwAAAABJRU5ErkJggg==)  
**📊 Scoring Explained**  
**Aesthetic Score (1–10)**  
Combines deep CNN features (MobileNetV2) with 6 CV metrics:  
   
 sharpness, exposure, saturation, tonal range, noise, compositional energy.  
   
 Tuned to match AVA dataset statistics (mean ≈ 5.5, std ≈ 1.0).  
**Composition Score (0–10)**  
60% proximity to rule-of-thirds intersections + 40% L/R and T/B luminosity balance.  
**Lighting Score (0–10)**  
Base score from exposure classification, penalised per % of clipped pixels.  
   
 Bonus for high tonal spread (std deviation) when exposure is balanced.  
**Sharpness Score (1–10)**  
Laplacian variance mapped via piecewise log scale:  
   
 < 50 → blurry (1–3), 50–200 → soft (3–6), 200–800 → good (6–8), > 800 → sharp (8–10).  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OQQmAABRAsScYxpg/h5VMYARvRrCCNxG2BFtmZquOAAD4i3Ot7mr/egIAwGvXA224BcUMk6pDAAAAAElFTkSuQmCC)  
**🎓 Academic Context**  
This project demonstrates:  
- **Computer Vision**: Laplacian blur detection, histogram analysis, contour-based saliency, colour space conversion  
- **Deep Learning**: Transfer learning with MobileNetV2, feature extraction, aesthetic prediction  
- **Full-Stack Integration**: REST API (Flask) ↔ Vanilla JS frontend with async/await  
- **UI/UX Engineering**: Canvas 2D visualisations, CSS animations, responsive design  
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnEAAAACCAYAAAA3pIp+AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVR4nO3OMQ2AABAAsSNBCkLfFR7wwIgHRiywEZJWQZeZ2ao9AAD+4lyruzq+ngAA8Nr1AOIEBeX8aGZPAAAAAElFTkSuQmCC)  
*Built with Flask · OpenCV · TensorFlow · Canvas API · CSS3*  
