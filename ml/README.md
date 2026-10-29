# FixLens AI — Standalone TF-IDF + Random Forest ML Prototype

**MCA Capstone Project: AI-Based Campus Maintenance Analysis and Improvement Management System**

This directory contains the machine learning pipeline developed to demonstrate how FixLens AI classifies campus maintenance reports into **Low**, **Medium**, or **High** priority before human-in-the-loop triage.

---

## 1. Architecture Overview

```
Complaint Text Description ──► [TF-IDF Vectorizer (1-2 ngrams, sublinear TF)] ──┐
Category (One-Hot)         ──► [OneHotEncoder]                                 ├──► [Combined Matrix] ──► [Random Forest (150 Trees)] ──► Priority (Low/Med/High)
Reported Urgency (One-Hot) ──► [OneHotEncoder]                                 │
People Affected (Numeric)  ──► [StandardScaler]                                ┘
```

- **Algorithm**: Random Forest Classifier (`n_estimators=150, max_depth=14, class_weight='balanced'`)
- **Text Feature Extraction**: `TfidfVectorizer` (unigrams + bigrams, English stop words, sublinear TF scaling, max 500 features)
- **Structured Features**: One-hot encoded category and student urgency, standardized affected count
- **Validation Strategy**: 80/20 Stratified Train/Test Split (96 train / 24 test) maintaining exact 8-8-8 balance across Low, Medium, and High priority classes

---

## 2. Decoupled Dataset Design (120 Records)

The training dataset (`dataset.csv`) intentionally decouples student-reported urgency from operational priority across 120 balanced records (40 High, 40 Medium, 40 Low):

```
Cross-Tabulation Matrix:
priority  High  Low  Medium  Total
urgency                    
High        20   12      12     44
Medium      12   12      20     44
Low          8   16       8     32
Total       40   40      40    120
```

- **High urgency $\rightarrow$ Low priority**: Minor cosmetic defects (broken chair backrest, overflowing waste paper bin, dead wall clock battery) are not elevated to high priority merely because the student selected High urgency.
- **Low/Medium urgency $\rightarrow$ High priority**: Genuine physical safety hazards (exposed live wire, gas leak, ceiling structural collapse) are triaged as High priority even if reported casually with Low or Medium urgency.

---

## 3. Evaluation Results on Held-out Test Data (24 Samples)

- **Overall Accuracy**: 75.00%
- **Macro Precision**: 75.04%
- **Macro Recall**: 75.00%
- **Macro F1-Score**: 73.78%
- **Per-Class Breakdown**:
  - **High**: Precision 85.7%, Recall 75.0%, F1 80.0%
  - **Medium**: Precision 72.7%, Recall 100.0%, F1 84.2%
  - **Low**: Precision 66.7%, Recall 50.0%, F1 57.1%

### Confusion Matrix
```
Predicted ──►  High  Medium  Low
Actual High       6       2    0
Actual Medium     1       4    3
Actual Low        0       0    8
```
*(Zero High-priority safety hazards were misclassified as Low)*

---

## 4. Dataset Limitations & Academic Honesty

1. **Curated Benchmark**: This dataset consists of 120 curated campus maintenance complaints designed to test multi-factor triage logic. It is not an uncurated historical export of thousands of industrial work orders.
2. **Generalization Scope**: Vocabulary is tailored to campus facilities (laboratories, classrooms, hostels, sports complex, library). Unseen technical jargon may produce lower model confidence scores.
3. **Production Deployment Recommendation**: In a live institutional deployment, the model should be continuously retrained against verified work order closures and supervisor priority confirmations.

---

## 5. Backups

Original models and dataset prior to decoupling are preserved in:
- `ml/backup/dataset.csv`
- `ml/backup/priority_model.joblib`
- `ml/backup/evaluation_results.json`
