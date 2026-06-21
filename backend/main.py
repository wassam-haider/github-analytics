import os
import httpx
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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

# Hugging Face Space URL for ML inference
HF_SPACE_URL = os.environ.get("HF_SPACE_URL", "").rstrip("/")

async def call_hf_predict(stars: float, forks: float, contributors: float, commit_frequency: float) -> float:
    """Forward a single prediction request to the Hugging Face Space."""
    if not HF_SPACE_URL:
        raise HTTPException(status_code=503, detail="Predictions temporarily unavailable — HF_SPACE_URL not configured.")
    payload = {
        "stars": stars,
        "forks": forks,
        "contributors": contributors,
        "commit_frequency": commit_frequency,
    }
    # Generous timeout to handle HF Space cold-start (free tier sleeps after ~15 min idle)
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(f"{HF_SPACE_URL}/predict", json=payload)
            resp.raise_for_status()
            return resp.json()["predicted_stars_next_month"]
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Model is warming up — please retry in a few seconds.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Inference service error: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=503, detail="Predictions temporarily unavailable.")


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
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contributor_scores')")
        exists = cur.fetchone()['exists']
        
        if exists:
            cur.execute("SELECT * FROM contributor_scores ORDER BY score DESC LIMIT 10")
            return cur.fetchall()
        else:
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
async def predict_growth(repo_id: int):
    """Predict star growth for a single repo — proxies to Hugging Face Space."""
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
    finally:
        cur.close()
        conn.close()

    predicted = await call_hf_predict(
        stars=data['stars'] or 0,
        forks=data['forks'] or 0,
        contributors=data['contributors_count'] or 0,
        commit_frequency=data['commit_frequency'] or 0,
    )

    return {
        "repo_id": repo_id,
        "current_stars": data['stars'],
        "expected_stars_next_month": round(predicted, 2),
    }

@app.get("/api/repos/top")
def get_top_repos():
    """Top 20 repositories by stars with forks, commit count, and health score."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                r.id,
                r.full_name AS name,
                r.language,
                r.stars,
                r.forks,
                (SELECT COUNT(*) FROM commits c WHERE c.repo_id = r.id) AS commit_count,
                h.health_score
            FROM repositories r
            LEFT JOIN (
                SELECT repo_id, health_score
                FROM repo_health_scores
            ) h ON h.repo_id = r.id
            ORDER BY r.stars DESC
            LIMIT 20
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


@app.get("/api/commits/trend")
def get_commit_trend():
    """Commit counts bucketed by day for time-series visualization."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                DATE_TRUNC('day', c.commit_date)::date::text AS period,
                COUNT(*) AS commit_count,
                r.language
            FROM commits c
            JOIN repositories r ON r.id = c.repo_id
            WHERE c.commit_date IS NOT NULL
            GROUP BY period, r.language
            ORDER BY period
        """)
        return cur.fetchall()
    except Exception:
        return []
    finally:
        cur.close()
        conn.close()


@app.get("/api/predictions/top-repos")
async def get_top_growth_predictions():
    """Top 10 repos predicted to gain the most stars — proxies to Hugging Face Space."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                r.id,
                r.full_name AS name,
                r.stars,
                r.forks,
                (SELECT COUNT(*) FROM contributors co WHERE co.repo_id = r.id) AS contributors_count,
                (SELECT COUNT(*) FROM commits com WHERE com.repo_id = r.id) AS commit_frequency
            FROM repositories r
            ORDER BY r.stars DESC
            LIMIT 50
        """)
        repos = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    results = []
    for repo in repos:
        predicted = await call_hf_predict(
            stars=repo['stars'] or 0,
            forks=repo['forks'] or 0,
            contributors=repo['contributors_count'] or 0,
            commit_frequency=repo['commit_frequency'] or 0,
        )
        results.append({
            "repo_id":         repo['id'],
            "name":            repo['name'],
            "current_stars":   repo['stars'],
            "predicted_stars": round(predicted, 2),
        })

    results.sort(key=lambda x: x['predicted_stars'] - x['current_stars'], reverse=True)
    return results[:10]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
