"""
Comprehensive Backend Test Suite for FixLens AI Priority API
Verifies:
- Case 1: Sparking electrical socket -> High
- Case 2: Broken tube light -> Medium
- Case 3: Classroom ceiling water leak -> High
- Case 4: Missing or invalid input -> 422 validation error
- Case 5: Model loaded once & health check verification
"""

import os
import sys

# Ensure parent directory is in path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from backend.main import app, health_check, predict_priority, ComplaintPredictRequest
from pydantic import ValidationError

def run_all_tests():
    print("=" * 60, flush=True)
    print("FixLens AI — Running Backend ML API Verification Suite", flush=True)
    print("=" * 60, flush=True)
    
    # Verification 1: Health endpoint & Model Loading
    health = health_check()
    assert health["status"] == "healthy", f"Health status was {health['status']}"
    assert health["model_loaded"] is True, "Model was not loaded"
    assert "High" in health["supported_classes"]
    print("[PASS] Test 1: Health check passed. Model loaded once at startup.", flush=True)
    print(f"       Supported classes: {health['supported_classes']}", flush=True)
    print(f"       Algorithm: {health['algorithm']}\n", flush=True)

    # Verification 2 (Case 1): Sparking electrical socket
    req1 = ComplaintPredictRequest(
        description="A sparking electrical socket with smoke and burning smell in the physics lab.",
        category="Electrical",
        urgency="High",
        affected=30,
    )
    res1 = predict_priority(req1)
    assert res1.status == "success"
    assert res1.priority == "High", f"Expected High, got {res1.priority}"
    assert res1.prediction_source == "Trained TF-IDF + Random Forest Model"
    print("[PASS] Test 2 (Case 1 - Sparking electrical socket):", flush=True)
    print(f"       Predicted Priority: {res1.priority} (Confidence: {res1.confidence*100:.1f}%)", flush=True)
    print(f"       Prediction Source: {res1.prediction_source}", flush=True)
    print(f"       Signals: {res1.signals[:2]}\n", flush=True)

    # Verification 3 (Case 2): Broken tube light
    req2 = ComplaintPredictRequest(
        description="A broken tube light flickering in classroom 101, making blackboard hard to read.",
        category="Electrical",
        urgency="Medium",
        affected=40,
    )
    res2 = predict_priority(req2)
    assert res2.status == "success"
    assert res2.priority == "Medium", f"Expected Medium, got {res2.priority}"
    assert res2.prediction_source == "Trained TF-IDF + Random Forest Model"
    print("[PASS] Test 3 (Case 2 - Broken tube light):", flush=True)
    print(f"       Predicted Priority: {res2.priority} (Confidence: {res2.confidence*100:.1f}%)", flush=True)
    print(f"       Signals: {res2.signals[:2]}\n", flush=True)

    # Verification 4 (Case 3): Classroom ceiling water leak
    req3 = ComplaintPredictRequest(
        description="A classroom ceiling water leak dripping onto student desks and computers.",
        category="Plumbing",
        urgency="High",
        affected=50,
    )
    res3 = predict_priority(req3)
    assert res3.status == "success"
    assert res3.priority == "High", f"Expected High, got {res3.priority}"
    assert res3.prediction_source == "Trained TF-IDF + Random Forest Model"
    print("[PASS] Test 4 (Case 3 - Classroom ceiling water leak):", flush=True)
    print(f"       Predicted Priority: {res3.priority} (Confidence: {res3.confidence*100:.1f}%)", flush=True)
    print(f"       Signals: {res3.signals[:2]}\n", flush=True)

    # Verification 5 (Case 4): Missing or invalid input
    # a) Empty description
    try:
        ComplaintPredictRequest(
            description="",
            category="Electrical",
            urgency="High",
            affected=10,
        )
        assert False, "Should have raised ValidationError for empty description"
    except ValidationError as e:
        print("[PASS] Test 5a (Missing description): Properly caught ValidationError:", flush=True)
        print(f"       {e.errors()[0]['msg']}", flush=True)

    # b) Negative / invalid affected count
    try:
        ComplaintPredictRequest(
            description="Valid issue description",
            category="Electrical",
            urgency="High",
            affected=-5,
        )
        assert False, "Should have raised ValidationError for negative affected"
    except ValidationError as e:
        print("[PASS] Test 5b (Negative affected count): Properly caught ValidationError:", flush=True)
        print(f"       {e.errors()[0]['msg']}\n", flush=True)

    # Verification 6: Broken classroom chair with High student urgency -> Low priority
    req6 = ComplaintPredictRequest(
        description="Broken classroom chair with cracked plastic backrest in back row.",
        category="Furniture",
        urgency="High",
        affected=5,
    )
    res6 = predict_priority(req6)
    assert res6.status == "success"
    assert res6.priority == "Low", f"Expected Low, got {res6.priority}"
    print("[PASS] Test 6 (Decoupled: Broken chair with High urgency):", flush=True)
    print(f"       Predicted Priority: {res6.priority} (Confidence: {res6.confidence*100:.1f}%)", flush=True)
    print(f"       Class Probabilities: {res6.class_probabilities}\n", flush=True)

    # Verification 7: Overflowing dustbin with High student urgency -> Low priority
    req7 = ComplaintPredictRequest(
        description="Overflowing classroom dustbin near teacher desk needs waste paper emptied.",
        category="Cleaning",
        urgency="High",
        affected=15,
    )
    res7 = predict_priority(req7)
    assert res7.status == "success"
    assert res7.priority == "Low", f"Expected Low, got {res7.priority}"
    print("[PASS] Test 7 (Decoupled: Overflowing dustbin with High urgency):", flush=True)
    print(f"       Predicted Priority: {res7.priority} (Confidence: {res7.confidence*100:.1f}%)", flush=True)
    print(f"       Class Probabilities: {res7.class_probabilities}\n", flush=True)

    # Verification 8: Safety hazard with Low student urgency -> High priority
    req8 = ComplaintPredictRequest(
        description="Noticed exposed copper live wire dangling from ceiling near basement fire exit staircase.",
        category="Electrical",
        urgency="Low",
        affected=50,
    )
    res8 = predict_priority(req8)
    assert res8.status == "success"
    assert res8.priority == "High", f"Expected High, got {res8.priority}"
    print("[PASS] Test 8 (Decoupled: Exposed live wire with Low urgency):", flush=True)
    print(f"       Predicted Priority: {res8.priority} (Confidence: {res8.confidence*100:.1f}%)", flush=True)
    print(f"       Class Probabilities: {res8.class_probabilities}\n", flush=True)

    print("=" * 60, flush=True)
    print("ALL BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!", flush=True)
    print("=" * 60, flush=True)

if __name__ == "__main__":
    run_all_tests()
