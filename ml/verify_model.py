"""
Verification script for FixLens AI trained Random Forest priority model
"""
import os
import joblib
import pandas as pd

def verify():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "priority_model.joblib")
    
    print(f"Checking model path: {model_path}")
    assert os.path.exists(model_path), "Model file not found!"
    
    pipeline = joblib.load(model_path)
    print(f"[VERIFIED] Loaded pipeline type: {type(pipeline).__name__}")
    
    step_names = [name for name, _ in pipeline.steps]
    print(f"[VERIFIED] Pipeline steps: {step_names}")
    assert "preprocessor" in step_names, "Missing preprocessor step!"
    assert "classifier" in step_names, "Missing classifier step!"
    
    preprocessor = pipeline.named_steps["preprocessor"]
    transformers = [t[0] for t in preprocessor.transformers]
    print(f"[VERIFIED] ColumnTransformer components: {transformers}")
    assert "text" in transformers, "Missing text transformer"
    assert "cat" in transformers, "Missing categorical transformer"
    assert "num" in transformers, "Missing numeric transformer"
    
    classifier = pipeline.named_steps["classifier"]
    classes = list(classifier.classes_)
    print(f"[VERIFIED] Classifier output classes: {classes}")
    assert set(classes) == {"High", "Medium", "Low"}, f"Unexpected classes: {classes}"
    
    test_cases = [
        ("A sparking electrical socket emitting smoke in the physics lab.", "Electrical", "High", 30),
        ("A broken tube light flickering in classroom 101.", "Electrical", "Medium", 40),
        ("A classroom ceiling water leak dripping onto student desks.", "Plumbing", "High", 50),
    ]
    
    print("\n[VERIFIED] Running test predictions:")
    for text, cat, urg, aff in test_cases:
        df = pd.DataFrame([{"description": text, "category": cat, "urgency": urg, "affected": aff}])
        pred = pipeline.predict(df)[0]
        probs = pipeline.predict_proba(df)[0]
        prob_dict = {cls: round(float(p), 4) for cls, p in zip(classes, probs)}
        print(f"  • \"{text}\" ({cat}, {urg}, {aff} affected)")
        print(f"    -> Predicted: {pred} | Probabilities: {prob_dict}")

if __name__ == "__main__":
    verify()
