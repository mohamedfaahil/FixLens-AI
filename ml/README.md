# FixLens AI — Standalone TF-IDF + Random Forest ML Prototype

**MCA Capstone Project: AI-Based Campus Maintenance Analysis and Improvement Management System**

This directory contains the standalone machine learning pipeline developed to demonstrate how FixLens AI classifies campus maintenance reports into **Low**, **Medium**, or **High** priority before human-in-the-loop triage.

---

## 1. Architecture Overview

```
Complaint Text Description ──► [TF-IDF Vectorizer (1-2 ngrams, sublinear TF)] ──┐
Category (One-Hot)         ──► [OneHotEncoder]                                 ├──► [Combined Matrix] ──► [Random Forest (100 Trees)] ──► Priority (Low/Med/High)
Reported Urgency (One-Hot) ──► [OneHotEncoder]                                 │
People Affected (Numeric)  ──► [StandardScaler]                                ┘
```

- **Algorithm**: Random Forest Classifier (`n_estimators=100, max_depth=10, class_weight='balanced'`)
- **Text Feature Extraction**: `TfidfVectorizer` (unigrams + bigrams, English stop-word filtering, sublinear TF scaling)
- **Structured Features**: One-hot encoded category and student urgency, standardized affected count
- **Validation Strategy**: 80/20 Stratified Train/Test Split maintaining class balance across all priority levels

---

## 2. Files in this Directory

- `dataset.csv`: Documented dataset of labeled campus maintenance complaints spanning Electrical, Plumbing, Safety, Internet/Wi-Fi, Cleaning, Furniture, and Other issues.
- `train_priority_model.py`: Complete training script with stratified train/test split, feature engineering, cross-evaluation, and artifact export.
- `predict_priority.py`: Inference utility for predicting new complaint priorities with confidence scores.
- `priority_model.joblib`: Serialized trained scikit-learn pipeline.
- `evaluation_results.json`: Documented evaluation metrics (Accuracy, Precision, Recall, F1-Score, Confusion Matrix).

---

## 3. How to Run

### Step 1: Train and Evaluate the Model

```bash
python ml/train_priority_model.py
```

### Step 2: Test Sample Predictions

```bash
python ml/predict_priority.py "Live wire sparking in staircase" "Safety" "High" 120
```

Output:

```text
Complaint: Live wire sparking in staircase
Prediction: High (Confidence: 89.4%)
Probabilities: {'High': 0.894, 'Low': 0.021, 'Medium': 0.085}
```
