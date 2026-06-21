# Project Build Prompt: GitHub Developer Analytics Platform

## ROLE

You are building the next phases of an existing Big Data project called the **GitHub Developer Analytics Platform**. Part of this system is already live in production. Your job is to extend it — NOT rebuild the parts that already work. Read this entire prompt before writing any code.

---

## 1. PROJECT GOAL (for context)

Build a platform that collects data from thousands of GitHub repositories and provides insights about:
- Developer productivity
- Programming language trends
- Open-source ecosystem health
- Repository growth
- Contributor performance

Think of it as a mini version of GitHub Insights.

---

## 2. FULL SYSTEM ARCHITECTURE (target end state)

```
GitHub API
     |
     v
Data Collector Service        <-- ALREADY BUILT AND RUNNING (see Section 3)
     |
     v
Raw Storage (Postgres, acts as both lake + warehouse for now)   <-- ALREADY BUILT
     |
     v
Apache Spark ETL              <-- YOU ARE BUILDING THIS
     |
     v
Data Warehouse (PostgreSQL — same Neon instance, new aggregate tables)  <-- YOU ARE BUILDING THIS
     |
     v
Analytics Engine (scoring formulas, trend detection)   <-- YOU ARE BUILDING THIS
     |
     v
ML Layer (RandomForestRegressor + MLflow/DagsHub registry)  <-- YOU ARE BUILDING THIS
     |
     v
React Dashboard               <-- YOU ARE BUILDING THIS
```

Note: the original plan separated "Raw Storage (JSON files)" as its own Data Lake stage before the warehouse. **We simplified this** — the collector writes directly into normalized PostgreSQL tables (acting as both the lake's source-of-truth and the queryable warehouse). Do not reintroduce a separate JSON file data lake stage unless explicitly asked.

---

## 3. WHAT IS ALREADY BUILT AND RUNNING ON GITHUB (do not rebuild)

The following exists in the GitHub repo already, is deployed, and is actively collecting real data on a schedule. Treat this as a fixed foundation you build on top of, not something to redesign.

### 3.1 Repo structure (current state)

```
github-analytics/
├── .github/
│   └── workflows/
│       └── collect.yml        # GitHub Actions cron, runs every 30 min
├── .gitignore
├── collector.py                # Data collection script (DONE, working)
├── requirements.txt             # requests, psycopg2-binary
└── schema.sql                   # Current DB schema (DONE, applied to Neon)
```

### 3.2 Database: PostgreSQL hosted on Neon (free tier, online, already provisioned)

Connection string is stored as a GitHub Actions secret called `DATABASE_URL`. The database is already live with real data being collected into it every 30 minutes.

### 3.3 Current schema (already applied — do not recreate these tables, only ADD new ones)

```sql
CREATE TABLE IF NOT EXISTS repositories (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    full_name TEXT UNIQUE NOT NULL,
    stars INT,
    forks INT,
    watchers INT,
    open_issues INT,
    language TEXT,
    created_at TIMESTAMP,
    collected_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contributors (
    id SERIAL PRIMARY KEY,
    repo_id BIGINT REFERENCES repositories(id),
    username TEXT NOT NULL,
    contributions INT,
    collected_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (repo_id, username)
);

CREATE TABLE IF NOT EXISTS commits (
    id SERIAL PRIMARY KEY,
    repo_id BIGINT REFERENCES repositories(id),
    sha TEXT UNIQUE,
    author TEXT,
    commit_date TIMESTAMP,
    message TEXT,
    collected_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pull_requests (
    id BIGINT PRIMARY KEY,
    repo_id BIGINT REFERENCES repositories(id),
    status TEXT,
    created_at TIMESTAMP,
    closed_at TIMESTAMP,
    merged_at TIMESTAMP,
    collected_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
    id BIGINT PRIMARY KEY,
    repo_id BIGINT REFERENCES repositories(id),
    status TEXT,
    created_at TIMESTAMP,
    closed_at TIMESTAMP,
    collected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributors_repo ON contributors(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_pulls_repo ON pull_requests(repo_id);
CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues(repo_id);
```

### 3.4 Current collector.py behavior (already working, do not rewrite)

- Authenticates to GitHub REST API using a fine-grained personal access token (`GITHUB_TOKEN` secret), giving 5,000 requests/hour
- **Dynamically discovers repos** via the GitHub Search API across these queries (not a hardcoded list):
  ```
  stars:>5000 language:Python
  stars:>5000 language:JavaScript
  stars:>5000 language:TypeScript
  stars:>5000 language:Go
  stars:>5000 language:Rust
  stars:>5000 language:Java
  stars:>5000 language:C++
  ```
- Processes `REPOS_PER_RUN` (default 20) new repos per run, skipping any repo collected within the last 6 hours (so frequent runs don't hammer the same repos)
- For each repo, collects: repo metadata, contributors (up to 5 pages), commits (up to 3 pages), pull requests (up to 3 pages, all states), issues (up to 3 pages, all states, excluding PRs which the issues endpoint also returns)
- All inserts use `ON CONFLICT ... DO UPDATE` (upsert) so re-collection is idempotent — no duplicate rows
- Has basic rate-limit handling: detects 403 rate-limit responses and sleeps until reset
- Wraps each repo's collection in its own DB transaction (commit per repo, rollback on failure) so one failing repo doesn't kill the whole run

### 3.5 Current GitHub Actions workflow (collect.yml) — already running

- Triggers on `cron: "7,37 * * * *"` (every 30 minutes, offset from peak `:00`/`:30` load) plus `workflow_dispatch` for manual runs
- Runs on `ubuntu-latest` (GitHub-hosted free runner)
- Installs deps from `requirements.txt`, runs `python collector.py`
- Reads `GH_API_TOKEN`, `DATABASE_URL`, and `REPOS_PER_RUN` from GitHub repo secrets/env

### 3.6 What this means practically

By the time you start work, the `repositories`, `contributors`, `commits`, `pull_requests`, and `issues` tables already contain real, growing data from popular GitHub repos across 7 languages, refreshed continuously. **You can build and test your Spark/analytics/ML/dashboard code directly against this live data — you do not need to write any new data collection code, and you do not need to seed or fake data.**

---

## 4. WHAT YOU NEED TO BUILD

### 4.1 Phase 4: Apache Spark ETL + Analytics

Install PySpark and build a script (`spark_etl.py` or similar) that:

1. Connects to the Neon Postgres instance (use the JDBC driver for Postgres, or read via `psycopg2`/`pandas` then convert to a Spark DataFrame — JDBC is preferred for "real" Big Data practice but either is acceptable for this scale)
2. Loads the 5 existing tables into Spark DataFrames
3. Computes the following analytics (mirroring the original plan):

**Analytics 1 — Most Popular Languages**
```python
df.groupBy("language").count()
```

**Analytics 2 — Top Contributors**
```python
contributors.groupBy("username").sum("contributions")
```

**Analytics 3 — Most Active Repositories**
```python
commits.groupBy("repo_id").count()
```

**Analytics 4 — Issue Resolution Time**
```python
# closed_at - created_at, in hours or days
# Compute: average closure time, fastest project, slowest project
```

**Analytics 5 — Pull Request Success Rate**
```python
# Merged PRs / Total PRs, per repository
```

4. Write the results of these aggregations into NEW summary tables in the same Postgres database (e.g. `language_stats`, `contributor_rankings`, `repo_activity`, `issue_resolution_stats`, `pr_success_rates`). Design these table schemas yourself, following the same style as the existing schema (explicit columns, appropriate types, a `computed_at TIMESTAMP DEFAULT NOW()` column on each so re-runs are traceable).

### 4.2 Phase 6: Advanced Analytics (scoring formulas)

Implement these as part of the same Spark job or a follow-up script:

**Productivity Score** (per contributor):
```
Score = (Commits * 0.5) + (PRs * 0.3) + (Issues Closed * 0.2)
```

**Repository Health Score** (per repository):
```
Health Score = Stars Growth + PR Success Rate + Issue Resolution Speed
```
(Use your judgment on normalizing/weighting these three sub-components to a comparable scale, e.g. 0–100, and document the formula choice in code comments.)

**Technology Trends**: determine most-used language, fastest-growing language, and most active ecosystem from the language_stats data over time.

Store these scores in new tables: `contributor_scores`, `repo_health_scores`.

### 4.3 Machine Learning Extension — Repository Growth Prediction

**Goal:** Predict expected stars next month for a repository.

**Inputs (features):** stars, forks, contributors count, commit frequency
**Output (target):** expected stars next month
**Model:** `RandomForestRegressor` (scikit-learn)

**Experiment tracking & model registry: use DagsHub + MLflow.**

Setup details (DagsHub-specific — follow these exactly):

1. Create a DagsHub repository (or connect the existing GitHub repo to DagsHub — DagsHub supports linking an existing GitHub repo directly)
2. DagsHub automatically provisions a free hosted MLflow tracking server for the repo at:
   ```
   https://dagshub.com/<DagsHub-username>/<repo-name>.mlflow
   ```
3. Install MLflow and the DagsHub client:
   ```bash
   pip install mlflow dagshub
   ```
4. In the training script, initialize DagsHub's MLflow integration and point MLflow at the DagsHub tracking server:
   ```python
   import dagshub
   import mlflow

   dagshub.init(repo_owner="<your-dagshub-username>", repo_name="<repo-name>", mlflow=True)
   # This sets MLFLOW_TRACKING_URI automatically, or you can set it explicitly:
   # mlflow.set_tracking_uri("https://dagshub.com/<your-dagshub-username>/<repo-name>.mlflow")
   ```
5. Train the model and log it with parameters/metrics:
   ```python
   from sklearn.ensemble import RandomForestRegressor
   from sklearn.model_selection import train_test_split
   from sklearn.metrics import mean_absolute_error, r2_score
   import mlflow.sklearn

   with mlflow.start_run():
       model = RandomForestRegressor(n_estimators=100, random_state=42)
       model.fit(X_train, y_train)

       preds = model.predict(X_test)
       mlflow.log_param("n_estimators", 100)
       mlflow.log_metric("mae", mean_absolute_error(y_test, preds))
       mlflow.log_metric("r2", r2_score(y_test, preds))

       mlflow.sklearn.log_model(
           sk_model=model,
           artifact_path="model",
           registered_model_name="repo-growth-predictor"
       )
   ```
6. This both logs the experiment AND registers the model into the DagsHub Model Registry in one call (`registered_model_name` triggers registration). Verify the model appears under the "Models" tab on the DagsHub repo page.
7. To load the registered model later for inference (e.g. from the dashboard backend):
   ```python
   import mlflow.sklearn
   model = mlflow.sklearn.load_model("models:/repo-growth-predictor/latest")
   ```

**Note:** do NOT use Kafka or Airflow anywhere in this build — they have been explicitly removed from project scope. Do not suggest reintroducing them.

### 4.4 Phase 7: React Dashboard

Build a React app (Chart.js + Material UI, per original plan) with 4 pages, reading from the new summary/score tables via a simple backend API (build a minimal FastAPI or Flask backend to expose the Postgres data as JSON endpoints — choose FastAPI for better async/Pydantic support unless you have a reason to prefer Flask).

**Page 1 — GitHub Overview**
Summary cards: Repositories analyzed, Contributors, Commits, Issues (simple COUNT queries)

**Page 2 — Language Analytics**
Pie chart + bar chart from `language_stats`

**Page 3 — Top Contributors**
Table: Rank, Username, Contributions, Score (from `contributor_scores`)

**Page 4 — Repository Health**
Display: Health Score, Issue Resolution Speed, PR Success Rate (from `repo_health_scores`)

Also add a small section/widget showing the ML prediction (expected stars next month) for a selected repository, calling the registered MLflow model.

---

## 5. TECHNOLOGY CHECKLIST (current scope — confirm this matches what you build)

Included:
- ✅ GitHub API (done)
- ✅ Python (done)
- ✅ Apache Spark (you build)
- ✅ PostgreSQL (done, you extend schema)
- ✅ ETL Pipeline (you build)
- ✅ Data Warehouse (done, you extend)
- ✅ React Dashboard (you build)
- ✅ DagsHub + MLflow (model registry — you build)

Explicitly EXCLUDED (do not add):
- ❌ Kafka
- ❌ Airflow
- ❌ Docker (optional, skip unless asked later)

---

## 6. CONSTRAINTS AND CONVENTIONS TO FOLLOW

1. **Do not modify `collector.py`, `schema.sql`, or `collect.yml` unless a bug is found.** These are working in production. If you believe a change is needed, flag it clearly and explain why before changing it.
2. **New summary/score tables only — do not alter the 5 existing tables' columns.**
3. Use the same Neon Postgres `DATABASE_URL` connection for everything (Spark, scoring, ML feature extraction, dashboard backend) — there is only one database.
4. Keep secrets (DB connection string, GitHub token, DagsHub token) out of code — read from environment variables, matching the existing `collector.py` pattern (`os.environ["VAR_NAME"]`).
5. This is a learning/portfolio project for internship applications — prioritize clear, well-commented, idiomatic code over premature optimization. Free-tier resource limits apply everywhere (Neon storage is capped, GitHub Actions has free-minute limits) — keep any new scheduled jobs lightweight.
6. If you add any new scheduled job (e.g. a daily Spark aggregation run), follow the same GitHub Actions pattern already used in `collect.yml` (separate workflow file under `.github/workflows/`), not a different scheduling mechanism, unless there's a strong technical reason — explain it if so.

---

## 7. SUGGESTED BUILD ORDER

1. Spark ETL script + new summary tables (Section 4.1)
2. Scoring formulas + score tables (Section 4.2)
3. ML training script with DagsHub/MLflow integration (Section 4.3)
4. FastAPI backend exposing summary/score/prediction data
5. React dashboard consuming that backend (Section 4.4)
6. (Optional, ask before doing) GitHub Actions workflow to re-run Spark ETL + scoring on a schedule (e.g. daily) so the dashboard stays fresh as the collector keeps adding data

Confirm your plan for Section 7 before writing code for each step, so we can course-correct early if needed.
