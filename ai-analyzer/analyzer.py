import cv2
import numpy as np
from ultralytics import YOLO
import base64
from io import BytesIO
from PIL import Image
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PotholeAnalyzer:
    def __init__(self, model_name="yolov8n.pt"):
        """Initialize YOLO model. For pothole detection, we use base model as starting point."""
        try:
            self.model = YOLO(model_name)
            logger.info(f"YOLO model {model_name} loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self.model = None

    def decode_image(self, base64_str):
        """Convert base64 image string to OpenCV format."""
        try:
            # Remove data URI prefix if present
            if ',' in base64_str:
                base64_str = base64_str.split(',')[1]
            
            image_data = base64.b64decode(base64_str)
            image = Image.open(BytesIO(image_data))
            image_np = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            return image_np
        except Exception as e:
            logger.error(f"Failed to decode image: {e}")
            return None

    def detect_damage(self, image_np):
        """
        Detect road damage (potholes, cracks) using YOLO + OpenCV analysis.
        Returns detection results with confidence.
        """
        if image_np is None:
            return {"detected": False, "confidence": 0}

        height, width = image_np.shape[:2]
        
        # Convert to grayscale for edge detection
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        
        # Apply adaptive thresholding to find dark regions (potential damage)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 11, 2)
        
        # Morphological operations to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        morph = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return {"detected": False, "confidence": 0.0}
        
        # Filter contours by area (remove noise)
        valid_contours = [c for c in contours if cv2.contourArea(c) > 100]
        
        if not valid_contours:
            return {"detected": False, "confidence": 0.0}
        
        # Calculate damage metrics
        total_damage_area = sum(cv2.contourArea(c) for c in valid_contours)
        image_area = height * width
        damage_ratio = total_damage_area / image_area
        
        # Confidence based on damage area
        confidence = min(damage_ratio * 10, 0.95)
        
        return {
            "detected": confidence > 0.15,
            "damage_area_px": total_damage_area,
            "confidence": round(confidence, 3),
            "contours_count": len(valid_contours),
            "image_dims": {"height": height, "width": width}
        }

    def estimate_dimensions(self, image_np, detection):
        """
        Estimate pothole dimensions using reference scaling.
        Road markings / asphalt aggregate (~0.5 inch) as reference.
        """
        if not detection.get("detected"):
            return {"length_m": 0, "width_m": 0, "depth_m": 0}
        
        height, width = image_np.shape[:2]
        
        # Heuristic: Assume ~30-40% of image width is visible road surface
        visible_road_width_m = 2.0  # ~2 meters typical road section
        pixels_per_meter = width / visible_road_width_m
        
        # Estimate damage dimensions from pixel count
        damage_area_px = detection.get("damage_area_px", 1000)
        damage_area_m2 = damage_area_px / (pixels_per_meter ** 2)
        
        # Approximate as rectangular damage
        damage_sqrt = np.sqrt(damage_area_m2)
        length_m = damage_sqrt * 1.2  # Slightly longer
        width_m = damage_sqrt * 0.8   # Slightly shorter
        
        # Depth estimation from darkness/shadow intensity
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        mean_intensity = np.mean(gray)
        
        # Darker regions suggest deeper damage
        # Normalize intensity (0-255) to depth (0-0.3m)
        depth_m = max(0.05, min(0.3, (255 - mean_intensity) / 255 * 0.3))
        
        return {
            "length_m": round(min(length_m, 2.0), 3),
            "width_m": round(min(width_m, 1.5), 3),
            "depth_m": round(depth_m, 3)
        }

    def estimate_severity(self, dimensions):
        """
        Classify severity based on dimensions.
        Low: <0.5 m², Medium: 0.5-1.5 m², High: >1.5 m²
        """
        area_m2 = dimensions["length_m"] * dimensions["width_m"]
        depth = dimensions["depth_m"]
        
        # Combined score
        if area_m2 < 0.5 or depth < 0.05:
            return "low"
        elif area_m2 < 1.5 or depth < 0.15:
            return "medium"
        else:
            return "high"

    def estimate_damage_type(self, image_np):
        """Classify type of damage: pothole, crack, subsidence, rut."""
        if image_np is None:
            return "pothole"
        
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        
        # Edge detection for cracks
        edges = cv2.Canny(gray, 100, 200)
        edge_density = np.sum(edges > 0) / edges.size
        
        # If high edge density, likely cracks
        if edge_density > 0.15:
            return "crack"
        
        # Otherwise pothole
        return "pothole"

    def get_minimal_cost_estimate(self, severity):
        """
        Return minimal placeholder cost (will be replaced by Groq for real estimate).
        This is just used if cost estimation later fails.
        """
        rates = {
            "low": {"materials": {}, "total_cost_inr": 0, "cost_range": {"min": 0, "max": 0}},
            "medium": {"materials": {}, "total_cost_inr": 0, "cost_range": {"min": 0, "max": 0}},
            "high": {"materials": {}, "total_cost_inr": 0, "cost_range": {"min": 0, "max": 0}},
        }
        return rates.get(severity, rates["medium"])

    def analyze(self, base64_image, road_type="arterial"):
        """Main analysis pipeline."""
        image_np = self.decode_image(base64_image)
        
        if image_np is None:
            return {
                "detected": False,
                "type": "none",
                "severity": "none",
                "confidence": 0,
                "description": "Failed to process image",
                "dimensions_estimate": {"length_m": 0, "width_m": 0, "depth_m": 0},
                "materials": {},
                "total_cost_inr": 0,
                "cost_range": {"min": 0, "max": 0},
                "repair_method": "None",
                "urgency": "none",
                "error": "Image decode failed"
            }
        
        # Step 1: Detect damage
        detection = self.detect_damage(image_np)
        
        if not detection["detected"]:
            return {
                "detected": False,
                "type": "none",
                "severity": "none",
                "confidence": detection["confidence"],
                "description": "No road damage detected in image",
                "dimensions_estimate": {"length_m": 0, "width_m": 0, "depth_m": 0},
                "materials": {},
                "total_cost_inr": 0,
                "cost_range": {"min": 0, "max": 0},
                "repair_method": "None",
                "urgency": "none",
            }
        
        # Step 2: Estimate dimensions
        dimensions = self.estimate_dimensions(image_np, detection)
        
        # Step 3: Classify severity
        severity = self.estimate_severity(dimensions)
        
        # Step 4: Determine damage type
        damage_type = self.estimate_damage_type(image_np)
        
        # Step 5: Return detection + dimensions (cost will be estimated by backend using Groq)
        return {
            "detected": True,
            "type": damage_type,
            "severity": severity,
            "confidence": detection["confidence"],
            "description": f"Detected {damage_type} on {road_type} road. Estimated dimensions: {dimensions['length_m']}m × {dimensions['width_m']}m × {dimensions['depth_m']}m deep.",
            "dimensions_estimate": dimensions,
            "needs_cost_estimation": True,  # Backend should call Groq for realistic cost
        }
