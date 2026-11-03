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
DEFAULT_MODEL_PATH = os.path.join(BASE_DIR, "ml", "priority_model.joblib")

def get_model_path() -> str:
    """Finds the trained Random Forest model artifact across supported deployment layouts."""
    env_path = os.environ.get("MODEL_PATH")
    if env_path and os.path.exists(env_path):
        return os.path.abspath(env_path)

    candidates = [
        DEFAULT_MODEL_PATH,
        os.path.join(os.getcwd(), "ml", "priority_model.joblib"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ml", "priority_model.joblib"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "priority_model.joblib"),
        os.path.join(os.getcwd(), "priority_model.joblib"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return os.path.abspath(path)

    return DEFAULT_MODEL_PATH

MODEL_PATH = get_model_path()

# Global pipeline reference loaded once at startup
ml_pipeline = None

def load_model():
    global ml_pipeline, MODEL_PATH
    if ml_pipeline is None:
        MODEL_PATH = get_model_path()
        if os.path.exists(MODEL_PATH):
            try:
                ml_pipeline = joblib.load(MODEL_PATH)
                print(f"[OK] Successfully loaded Random Forest model pipeline from: {MODEL_PATH}")
            except Exception as e:
                print(f"[ERROR] Failed to load model pipeline from {MODEL_PATH}: {e}")
        else:
            print(f"[WARNING] Model file not found at: {MODEL_PATH}")
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

# --------------------------------------------------------------------
# CORS Configuration: Production Hardened
# --------------------------------------------------------------------
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("CORS_ORIGINS")
is_production = (
    os.environ.get("RENDER") == "true"
    or os.environ.get("ENVIRONMENT") == "production"
    or os.environ.get("NODE_ENV") == "production"
)

if allowed_origins_env:
    # Explicit allowed origins parsed from environment (Production / Staging)
    origins_list = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins_list,
        allow_origin_regex=None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
elif is_production:
    # Production without ALLOWED_ORIGINS: Reject wildcard access for security
    print("[WARNING] Running in production mode but ALLOWED_ORIGINS is not set! Denying open public origins.")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[],
        allow_origin_regex=None,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    # Local development without ALLOWED_ORIGINS: Strictly permit localhost and 127.0.0.1
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

class ComplaintPredictRequest(BaseModel):
    description: str = Field(..., min_length=3, description="Detailed description of the maintenance issue")
    category: Optional[str] = Field(default="Other", description="Maintenance category (e.g. Electrical, Plumbing, Safety)")
    urgency: Optional[str] = Field(default="Medium", description="Reported urgency level (Low, Medium, High)")
    affected: Optional[int] = Field(default=1, ge=1, le=10000, description="Estimated number of students/staff affected")

class PredictionResponse(BaseModel):
    status: str
    priority: str
    confidence: float
    class_probabilities: Dict[str, float]
    prediction_source: str
    signals: List[str]
    error: Optional[str] = None

@app.get("/", summary="Root Status")
def root_status():
    """Returns service health status and model availability."""
    pipeline = load_model()
    is_ready = pipeline is not None
    return {
        "status": "online",
        "service": "FixLens AI Priority Prediction API",
        "model_loaded": is_ready,
        "version": "1.0.0",
        "algorithm": "TF-IDF + Random Forest Classifier (100 estimators, balanced weights)",
        "endpoints": {
            "health": "/health",
            "predict": "/predict-priority",
            "docs": "/docs",
        },
    }

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
        # Sanitize and normalize input values for Random Forest pipeline
        desc = (req.description or "").strip()
        cat = (req.category or "Other").strip() or "Other"
        raw_urg = (req.urgency or "Medium").strip().capitalize()
        urg = raw_urg if raw_urg in ["High", "Medium", "Low"] else "Medium"
        aff = max(1, min(10000, int(req.affected or 1)))

        # Prepare DataFrame strictly matching model training columns
        input_data = pd.DataFrame([
            {
                "description": desc,
                "category": cat,
                "urgency": urg,
                "affected": aff,
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
            f"Issue category factor: {cat}",
            f"Reported student urgency: {urg}",
            f"Impact scale: {aff} person(s) affected",
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
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"[INFO] Starting FixLens AI Prediction Service on http://{host}:{port}")
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)
