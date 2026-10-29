# FixLens AI — Machine Learning Backend Service

Lightweight FastAPI service serving the trained scikit-learn priority prediction model for FixLens AI.

## Architecture

- **Model Pipeline**: `ml/priority_model.joblib`
  - Text feature extraction: `TfidfVectorizer(max_features=500, stop_words='english', ngram_range=(1, 2))`
  - Categorical feature encoding: `OneHotEncoder(handle_unknown='ignore')`
  - Numeric feature scaling: `StandardScaler()`
  - Classifier: `RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42)`
- **Evaluation Accuracy**: 95.45% on held-out test split (see `ml/evaluation_results.json`)
- **Supported Priority Classes**: `High`, `Medium`, `Low`

## Requirements

Python 3.10+ with the following packages installed:

```bash
pip install -r backend/requirements.txt
```

## Running the API Service

From the project root:

```bash
# Option 1: Using uvicorn directly
uvicorn backend.main:app --port 8000 --reload

# Option 2: Running the script directly
python backend/main.py
```

The service will start on: `http://127.0.0.1:8000`

Interactive OpenAPI / Swagger docs are available at: `http://127.0.0.1:8000/docs`

## Endpoints

### 1. Health Check
- **GET** `/health`
- **Response**:
```json
{
  "status": "healthy",
  "service": "FixLens AI Priority Prediction API",
  "model_loaded": true,
  "model_path": ".../ml/priority_model.joblib",
  "supported_classes": ["High", "Low", "Medium"],
  "algorithm": "TF-IDF + Random Forest Classifier (100 estimators, balanced weights)"
}
```

### 2. Priority Prediction
- **POST** `/predict-priority`
- **Request Body**:
```json
{
  "description": "Sparking electrical socket with smoke and burning smell in the lab",
  "category": "Electrical",
  "urgency": "High",
  "affected": 30
}
```
- **Response**:
```json
{
  "status": "success",
  "priority": "High",
  "confidence": 0.5859,
  "class_probabilities": {
    "High": 0.5859,
    "Low": 0.1569,
    "Medium": 0.2572
  },
  "prediction_source": "Trained TF-IDF + Random Forest Model",
  "signals": [
    "Random Forest confidence: 58.6% for High priority",
    "Class probability distribution: High 59%, Medium 26%, Low 16%",
    "Issue category factor: Electrical",
    "Reported student urgency: High",
    "Impact scale: 30 person(s) affected"
  ]
}
```

## Running the Test Suite

```bash
python backend/test_api.py
```
Verifies:
1. Health check & single model load at startup
2. Case 1: Sparking electrical socket -> High
3. Case 2: Broken tube light -> Medium
4. Case 3: Classroom ceiling water leak -> High
5. Case 4: Missing or invalid input handling (422)
