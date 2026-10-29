"""
FixLens AI — FastAPI Priority Prediction Service
Connects the trained TF-IDF + Random Forest model pipeline to the frontend.
"""

import os
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Locate the trained model artifact
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "ml", "priority_model.joblib")

# Global pipeline reference loaded once at startup
ml_pipeline = None

def load_model():
    global ml_pipeline
    if ml_pipeline is None and os.path.exists(MODEL_PATH):
        try:
            ml_pipeline = joblib.load(MODEL_PATH)
            print(f"[OK] Successfully loaded Random Forest model pipeline from: {MODEL_PATH}")
        except Exception as e:
            print(f"[ERROR] Failed to load model pipeline: {e}")
    return ml_pipeline

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield

app = FastAPI(
    title="FixLens AI Priority Prediction API",
    description="FastAPI service serving the trained TF-IDF + Random Forest priority classification model.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local frontend dev servers (e.g., ports 3000, 5173, 8080)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ComplaintPredictRequest(BaseModel):
    description: str = Field(..., min_length=3, description="Detailed description of the maintenance issue")
    category: str = Field(..., min_length=2, description="Maintenance category (e.g. Electrical, Plumbing, Safety)")
    urgency: str = Field(..., description="Reported urgency level (Low, Medium, High)")
    affected: int = Field(default=1, ge=1, le=10000, description="Estimated number of students/staff affected")

class PredictionResponse(BaseModel):
    status: str
    priority: str
    confidence: float
    class_probabilities: Dict[str, float]
    prediction_source: str
    signals: List[str]
    error: Optional[str] = None

@app.get("/health", summary="Health Check")
def health_check():
    """Returns service health status and model availability."""
    pipeline = load_model()
    is_ready = pipeline is not None
    return {
        "status": "healthy" if is_ready else "degraded",
        "service": "FixLens AI Priority Prediction API",
        "model_loaded": is_ready,
        "model_path": MODEL_PATH,
        "supported_classes": list(pipeline.named_steps["classifier"].classes_) if is_ready else [],
        "algorithm": "TF-IDF + Random Forest Classifier (100 estimators, balanced weights)",
    }

@app.post(
    "/predict-priority",
    response_model=PredictionResponse,
    summary="Predict Complaint Priority",
)
def predict_priority(req: ComplaintPredictRequest):
    """
    Accepts complaint description, category, urgency, and affected count.
    Processes features through TF-IDF and ColumnTransformer, then evaluates
    with the trained Random Forest classifier.
    """
    pipeline = load_model()
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trained Random Forest model pipeline is not loaded. Please ensure priority_model.joblib exists.",
        )

    try:
        # Prepare DataFrame strictly matching model training columns
        input_data = pd.DataFrame([
            {
                "description": req.description.strip(),
                "category": req.category.strip(),
                "urgency": req.urgency.strip(),
                "affected": req.affected,
            }
        ])

        # Execute prediction through ColumnTransformer + RandomForest pipeline
        predicted_priority = pipeline.predict(input_data)[0]
        probabilities = pipeline.predict_proba(input_data)[0]
        classes = list(pipeline.named_steps["classifier"].classes_)

        prob_dict = {
            cls_name: round(float(p), 4) for cls_name, p in zip(classes, probabilities)
        }
        confidence = prob_dict.get(predicted_priority, 0.0)

        # Build explainable signals from model inference
        signals = [
            f"Random Forest confidence: {confidence * 100:.1f}% for {predicted_priority} priority",
            f"Class probability distribution: High {prob_dict.get('High', 0)*100:.0f}%, Medium {prob_dict.get('Medium', 0)*100:.0f}%, Low {prob_dict.get('Low', 0)*100:.0f}%",
            f"Issue category factor: {req.category.strip()}",
            f"Reported student urgency: {req.urgency.strip()}",
            f"Impact scale: {req.affected} person(s) affected",
        ]

        return PredictionResponse(
            status="success",
            priority=predicted_priority,
            confidence=round(confidence, 4),
            class_probabilities=prob_dict,
            prediction_source="Trained TF-IDF + Random Forest Model",
            signals=signals,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction inference failed: {str(exc)}",
        )

if __name__ == "__main__":
    import uvicorn
    print("[INFO] Starting FixLens AI Prediction Service on http://127.0.0.1:8000")
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
