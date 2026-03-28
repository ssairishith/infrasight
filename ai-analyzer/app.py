from flask import Flask, request, jsonify
from flask_cors import CORS
from analyzer import PotholeAnalyzer
import logging
import os

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize analyzer on startup
analyzer = None

def init_analyzer():
    global analyzer
    try:
        analyzer = PotholeAnalyzer("yolov8n.pt")
        logger.info("PotholeAnalyzer initialized")
    except Exception as e:
        logger.error(f"Failed to initialize analyzer: {e}")
        analyzer = PotholeAnalyzer()

@app.before_request
def before_request():
    global analyzer
    if analyzer is None:
        init_analyzer()

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "pothole-analyzer"}), 200

@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analyze road image for damage.
    
    Request body:
    {
        "image": "base64_string_of_image",
        "roadType": "arterial" | "residential" | "highway"
    }
    
    Response:
    {
        "detected": bool,
        "type": "pothole" | "crack" | "subsidence",
        "severity": "low" | "medium" | "high",
        "confidence": float (0-1),
        "description": str,
        "dimensions_estimate": { "length_m": float, "width_m": float, "depth_m": float },
        "materials": { ... },
        "total_cost_inr": int,
        "cost_range": { "min": int, "max": int },
        "repair_method": str,
        "urgency": "immediate" | "within_week" | "within_month"
    }
    """
    try:
        data = request.get_json()
        
        if not data or "image" not in data:
            return jsonify({"error": "Missing 'image' in request body"}), 400
        
        base64_image = data["image"]
        road_type = data.get("roadType", "arterial")
        
        # Run analysis
        result = analyzer.analyze(base64_image, road_type)
        
        return jsonify(result), 200
    
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        return jsonify({"error": str(e), "detected": False}), 500

@app.route("/", methods=["GET"])
def index():
    """Info endpoint."""
    return jsonify({
        "service": "InfraSight AI Analyzer",
        "version": "1.0.0",
        "endpoints": {
            "/health": "GET - Health check",
            "/analyze": "POST - Analyze road image for damage"
        }
    })

if __name__ == "__main__":
    port = int(os.environ.get("ANALYZER_PORT", 5001))
    logger.info(f"Starting analyzer service on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
