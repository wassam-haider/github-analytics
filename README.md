# 🗂️ GitHub Analytics — Developer Insights Platform

A full-stack big-data analytics platform that collects GitHub repository data, processes it with Apache Spark, trains a growth-prediction ML model, and visualises everything in a kraft-paper themed React dashboard.

---

## 🏗️ Project Structure

```
github-analytics/
├── collector.py          # GitHub API data ingestion script
├── spark_etl.py          # Apache Spark ETL (aggregation pipeline)
├── train_model.py        # ML model training (RandomForest + MLflow/DagsHub)
├── schema.sql            # Neon PostgreSQL schema
├── requirements.txt      # Collector dependencies
├── requirements-etl.txt  # Spark ETL & ML training dependencies
├── backend/
│   ├── main.py           # FastAPI backend (7 endpoints)
│   └── requirements.txt  # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/        # 7 dashboard pages
│   │   ├── components/   # PredictWidget
│   │   ├── App.tsx       # Sidebar nav + routing
│   │   └── index.css     # Kraft Paper design system
│   └── package.json
└── .github/workflows/
    ├── collect.yml       # GitHub Actions: data collection (every 30 min)
    ├── etl.yml           # GitHub Actions: Spark ETL (daily 1AM UTC)
    └── ml_training.yml   # GitHub Actions: model training (daily 2AM UTC)
```

---

## ⚙️ Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11 | Use `py -3.11` on Windows if multiple versions are installed |
| Node.js | 18+ | For the React frontend |
| Java | 8 or 11 | Required by Apache Spark (for local ETL runs) |

---

## 🔑 Environment Variables / Secrets

### GitHub Actions Secrets (Settings → Secrets and variables → Actions)

| Secret Name | Value |
|-------------|-------|
| `DATABASE_URL` | Your Neon PostgreSQL connection string |
| `GH_API_TOKEN` | GitHub Personal Access Token (`repo`, `read:org` scopes) |
| `DAGSHUB_TOKEN` | DagsHub Personal Access Token |

### GitHub Actions Variables

| Variable Name | Value |
|---------------|-------|
| `DAGSHUB_USER` | `wassam-haider` |
| `DAGSHUB_REPO` | `github-analytics` |

---

## 🚀 Running Locally

### Step 1 — Create the Python 3.11 Virtual Environment

> Run once from the project root. The `venv/` folder will be created inside the project directory.

```powershell
# From: d:\7thsem\bigdata\github-analytics\
py -3.11 -m venv venv
```

---

### Step 2 — Start the FastAPI Backend

> Open a **dedicated PowerShell window** for the backend. Keep it running while you use the dashboard.

```powershell
# From: d:\7thsem\bigdata\github-analytics\

# Install backend dependencies (run once)
.\venv\Scripts\pip install -r backend\requirements.txt

# Set credentials and start the server
$env:DATABASE_URL         = "postgresql://neondb_owner:npg_vDo51mBiPWMu@ep-soft-fire-at2q1e9e-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:DAGSHUB_USER_TOKEN   = "f78bf9295cf829abc78ea1cb61f948e50c4d859a"
$env:MLFLOW_TRACKING_USERNAME = "wassam-haider"
$env:MLFLOW_TRACKING_PASSWORD = "f78bf9295cf829abc78ea1cb61f948e50c4d859a"
$env:DAGSHUB_USER         = "wassam-haider"
$env:DAGSHUB_REPO         = "github-analytics"

cd backend
..\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Backend API will be live at: **http://localhost:8000**
Interactive docs at: **http://localhost:8000/docs**

---

### Step 3 — Start the React Frontend

> Open a **second PowerShell window** for the frontend.

```powershell
# From: d:\7thsem\bigdata\github-analytics\frontend\

# Install Node dependencies (run once)
npm install

# Start the development server
npm run dev
```

Dashboard will be live at: **http://localhost:5173**

---

### Step 4 (Optional) — Run the Spark ETL Locally

> Requires Java 8/11 and the Spark JDBC JAR. This normally runs in GitHub Actions.

```powershell
# From: d:\7thsem\bigdata\github-analytics\

# Install ETL dependencies (run once)
.\venv\Scripts\pip install -r requirements-etl.txt

# Run the ETL
$env:DATABASE_URL = "postgresql://neondb_owner:npg_vDo51mBiPWMu@ep-soft-fire-at2q1e9e-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
.\venv\Scripts\python spark_etl.py
```

---

### Step 5 (Optional) — Train the ML Model Locally

```powershell
# From: d:\7thsem\bigdata\github-analytics\

$env:DATABASE_URL             = "postgresql://..."
$env:DAGSHUB_USER_TOKEN       = "f78bf9295cf829abc78ea1cb61f948e50c4d859a"
$env:MLFLOW_TRACKING_USERNAME = "wassam-haider"
$env:MLFLOW_TRACKING_PASSWORD = "f78bf9295cf829abc78ea1cb61f948e50c4d859a"
$env:DAGSHUB_USER             = "wassam-haider"
$env:DAGSHUB_REPO             = "github-analytics"

.\venv\Scripts\python train_model.py
```

The trained model is registered to **DagsHub MLflow** and automatically loaded by the backend on startup.

---

## 📊 Dashboard Pages

| Page | Route | Description |
|------|-------|-------------|
| Overview | `/` | Stat cards (repos, contributors, commits, issues) with sparklines |
| Language Analytics | `/languages` | Pie + Bar charts, language trend line |
| Top Contributors | `/contributors` | Ranked ledger table with productivity score bars |
| Repository Health | `/health` | SVG gauge dials per repo (0–100 health score) |
| Top Repositories | `/repos` | Sortable leaderboard (stars, forks, commits, health) |
| Commit Activity | `/commits` | Calendar heatmap + filterable trend line chart |
| Predictions | `/predictions` | ML forecasts — top repos to watch, next big language, commit forecast |

---

## 🔄 Automated Pipelines (GitHub Actions)

| Workflow | Schedule | What it does |
|----------|----------|--------------|
| `collect.yml` | Every 30 minutes | Runs `collector.py` to fetch new GitHub repo data via the API |
| `etl.yml` | Daily at 1:00 AM UTC | Runs the Spark ETL to aggregate raw data into summary tables |
| `ml_training.yml` | Daily at 2:00 AM UTC | Trains the RandomForest growth model and registers it to DagsHub |

All workflows can also be triggered manually from the **Actions** tab on GitHub.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, Chart.js, Axios, React Router |
| Backend | FastAPI, Uvicorn, psycopg2, MLflow, DagsHub |
| Data Pipeline | Apache Spark (PySpark), PostgreSQL JDBC |
| ML | scikit-learn (RandomForestRegressor), MLflow experiment tracking |
| Database | Neon PostgreSQL (cloud-hosted) |
| CI/CD | GitHub Actions |
| ML Registry | DagsHub + MLflow Model Registry |
