# FixLens AI — AI-Based Campus Maintenance Analysis and Improvement Management System

MCA Capstone Project: A full-stack campus maintenance management system with student reporting, administrative dispatching, campus improvement proposals & voting, and real-time AI priority assistance powered by a trained scikit-learn TF-IDF + Random Forest model pipeline.

---

## Architecture Overview

1. **Frontend**: Vite + TanStack Router + React + Tailwind CSS + Lucide Icons + Recharts
   - Student portal: Complaint submission, photo preview, live ML priority prediction, tracking, campus improvement hub.
   - Admin portal: Priority queue, complaint dispatching & timeline management, analytics, proposal approval, printable PDF/HTML reports, and AI model health dashboard.
   - Session store: Shared in-memory React state (`src/lib/demo-store.tsx`) enabling cross-role synchronization without persistent database locking.
2. **Backend ML Service**: FastAPI + Uvicorn (`backend/main.py`)
   - Model artifact: `ml/priority_model.joblib` (Trained TF-IDF + ColumnTransformer + 100-tree Random Forest classifier, 95.45% evaluation accuracy).
   - Endpoints: `GET /health` and `POST /predict-priority`.
   - Eager model loading once at startup with failover to honest demo heuristic when offline.

---

## Quick Start Guide

### Step 1: Start the Python ML Prediction Service

```bash
# Navigate to the project directory
cd project-launchpad-main

# Install Python ML dependencies
pip install -r backend/requirements.txt

# Run the FastAPI server (starts on http://127.0.0.1:8000)
python backend/main.py
# Or: uvicorn backend.main:app --port 8000 --reload
```

Interactive API documentation will be available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Step 2: Start the Frontend Application

In a separate terminal:

```bash
cd project-launchpad-main

# Install npm dependencies (if not already installed)
npm install

# Start Vite development server
npm run dev
```

Open your browser at: [http://localhost:5173](http://localhost:5173) or the port displayed in your terminal.

---

## Verification & Testing

### 1. Backend ML API Test Suite
Executes all 5 required verification test cases:
- Sparking electrical socket -> `High`
- Broken tube light -> `Medium`
- Classroom ceiling water leak -> `High`
- Missing/invalid input validation (422)
- API health check & startup model loading

```bash
python backend/test_api.py
```

### 2. Frontend Test Suite
Runs Vitest for workflow, routing, and ML API integration/fallback tests:

```bash
npm test
```

### 3. Production Build
Verifies that all TypeScript routes, SSR nitro bundles, and client assets compile with 0 errors:

```bash
npm run build
```

---

## Machine Learning Pipeline Summary

- **Dataset**: `ml/dataset.csv` (108 campus complaints categorized across Electrical, Plumbing, Cleaning, Wi-Fi, Furniture, and Safety).
- **Features**:
  - Text: `description` processed with `TfidfVectorizer(max_features=500, stop_words='english', ngram_range=(1,2))`
  - Categorical: `category` & `urgency` encoded with `OneHotEncoder(handle_unknown='ignore')`
  - Numeric: `affected` scaled with `StandardScaler()`
- **Classifier**: `RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42)`
- **Evaluation**: 95.45% accuracy, 95.8% macro precision, 95.8% macro recall (see `ml/evaluation_results.json`).
