"""
FixLens AI — Standalone ML Priority Prediction Utility
Loads the trained TF-IDF + Random Forest model pipeline and predicts priority for complaints.
"""

import os
import joblib
import pandas as pd

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "priority_model.joblib")

def load_pipeline():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Run train_priority_model.py first.")
    return joblib.load(MODEL_PATH)

def predict_complaint_priority(description: str, category: str, urgency: str, affected: int):
    pipeline = load_pipeline()
    input_df = pd.DataFrame([{
        "description": description,
        "category": category,
        "urgency": urgency,
        "affected": affected,
    }])
    
    predicted_priority = pipeline.predict(input_df)[0]
    probabilities = pipeline.predict_proba(input_df)[0]
    prob_map = {cls: round(float(prob), 4) for cls, prob in zip(pipeline.classes_, probabilities)}
    
    return {
        "predicted_priority": predicted_priority,
        "confidence": prob_map[predicted_priority],
        "class_probabilities": prob_map,
    }

if __name__ == "__main__":
    import sys
    desc = sys.argv[1] if len(sys.argv) > 1 else "Sparks and burning smell coming from main circuit breaker board"
    cat = sys.argv[2] if len(sys.argv) > 2 else "Electrical"
    urg = sys.argv[3] if len(sys.argv) > 3 else "High"
    aff = int(sys.argv[4]) if len(sys.argv) > 4 else 80

    result = predict_complaint_priority(desc, cat, urg, aff)
    print(f"Complaint: {desc}")
    print(f"Prediction: {result['predicted_priority']} (Confidence: {result['confidence'] * 100:.1f}%)")
    print(f"Probabilities: {result['class_probabilities']}")
