import os
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mlflow.sklearn
import dagshub

app = FastAPI(title="GitHub Analytics API")

# Allow CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    database_url = os.environ.get("DATABASE_URL", "postgresql://neondb_owner:npg_vDo51mBiPWMu@ep-soft-fire-at2q1e9e-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require")
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

# Attempt to load MLflow model on startup
ML_MODEL = None
try:
    repo_owner = os.environ.get("DAGSHUB_USER", "wassam-haider")
    repo_name = os.environ.get("DAGSHUB_REPO", "github-analytics")
    # Initialize Dagshub (sets up MLflow tracking URI)
    dagshub.init(repo_owner=repo_owner, repo_name=repo_name, mlflow=True)
    print("Loading model from MLflow registry...")
    ML_MODEL = mlflow.sklearn.load_model("models:/repo-growth-predictor/latest")
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Could not load ML model on startup. Prediction endpoint will fail. {e}")

@app.get("/api/overview")
def get_overview():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) as repos FROM repositories")
        repos = cur.fetchone()['repos']
        
        cur.execute("SELECT COUNT(*) as contributors FROM contributors")
        contributors = cur.fetchone()['contributors']
        
        cur.execute("SELECT COUNT(*) as commits FROM commits")
        commits = cur.fetchone()['commits']
        
        cur.execute("SELECT COUNT(*) as issues FROM issues")
        issues = cur.fetchone()['issues']
        
        return {
            "repositories": repos,
            "contributors": contributors,
            "commits": commits,
            "issues": issues
        }
    finally:
        cur.close()
        conn.close()

@app.get("/api/languages")
def get_languages():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Fallback to direct grouping if table not yet populated by Spark
        cur.execute("""
            SELECT language, count(*) as repo_count 
            FROM repositories 
            WHERE language IS NOT NULL 
            GROUP BY language 
            ORDER BY repo_count DESC
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()

@app.get("/api/contributors")
def get_top_contributors():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Check if contributor_scores table exists
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contributor_scores')")
        exists = cur.fetchone()['exists']
        
        if exists:
            cur.execute("SELECT * FROM contributor_scores ORDER BY score DESC LIMIT 10")
            return cur.fetchall()
        else:
            # Fallback to base table
            cur.execute("""
                SELECT username, SUM(contributions) as score 
                FROM contributors 
                GROUP BY username 
                ORDER BY score DESC LIMIT 10
            """)
            return cur.fetchall()
    finally:
        cur.close()
        conn.close()

@app.get("/api/health")
def get_repo_health():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'repo_health_scores')")
        exists = cur.fetchone()['exists']
        
        if exists:
            cur.execute("SELECT * FROM repo_health_scores ORDER BY health_score DESC LIMIT 20")
            return cur.fetchall()
        else:
            return []
    finally:
        cur.close()
        conn.close()

@app.get("/api/predict/{repo_id}")
def predict_growth(repo_id: int):
    if ML_MODEL is None:
        raise HTTPException(status_code=503, detail="ML Model is not loaded")
        
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                r.stars,
                r.forks,
                (SELECT COUNT(*) FROM contributors c WHERE c.repo_id = r.id) as contributors_count,
                (SELECT COUNT(*) FROM commits com WHERE com.repo_id = r.id) as commit_frequency
            FROM repositories r
            WHERE r.id = %s
        """, (repo_id,))
        
        data = cur.fetchone()
        if not data:
            raise HTTPException(status_code=404, detail="Repository not found")
            
        features = [[
            data['stars'] or 0,
            data['forks'] or 0,
            data['contributors_count'] or 0,
            data['commit_frequency'] or 0
        ]]
        
        prediction = ML_MODEL.predict(features)[0]
        
        return {
            "repo_id": repo_id,
            "current_stars": data['stars'],
            "expected_stars_next_month": round(prediction, 2)
        }
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
