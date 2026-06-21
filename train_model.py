import os
import urllib.parse
import pandas as pd
import psycopg
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import mlflow.sklearn
import dagshub
import joblib

def get_db_connection():
    database_url = os.environ.get("DATABASE_URL", "postgresql://neondb_owner:npg_vDo51mBiPWMu@ep-soft-fire-at2q1e9e-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require")
    return psycopg.connect(database_url)

def fetch_training_data():
    conn = get_db_connection()
    
    # Query to gather features: stars, forks, contributors count, commit frequency
    query = """
    SELECT 
        r.id as repo_id,
        r.stars,
        r.forks,
        (SELECT COUNT(*) FROM contributors c WHERE c.repo_id = r.id) as contributors_count,
        (SELECT COUNT(*) FROM commits com WHERE com.repo_id = r.id) as commit_frequency
    FROM repositories r
    WHERE r.stars IS NOT NULL AND r.forks IS NOT NULL
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    # Fill any NaNs with 0
    df.fillna(0, inplace=True)
    
    # Synthetic target: 'expected stars next month' 
    # Since we lack historical snapshots, we simulate this based on current metrics
    # to demonstrate the ML pipeline capability.
    df['target_stars_next_month'] = df['stars'] + (df['forks'] * 0.5) + (df['commit_frequency'] * 0.1) + 10
    
    return df

def main():
    print("Fetching data from Neon Postgres...")
    df = fetch_training_data()
    print(f"Loaded {len(df)} records for training.")

    if len(df) == 0:
        print("Not enough data to train. Exiting.")
        return

    features = ['stars', 'forks', 'contributors_count', 'commit_frequency']
    X = df[features]
    y = df['target_stars_next_month']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Initialize DagsHub MLflow tracking
    # We use placeholder credentials if env vars are missing. 
    # The user should set DAGSHUB_USER and DAGSHUB_REPO.
    repo_owner = os.environ.get("DAGSHUB_USER", "wassam-haider")
    repo_name = os.environ.get("DAGSHUB_REPO", "github-analytics")
    
    try:
        print(f"Initializing DagsHub MLflow for {repo_owner}/{repo_name}...")
        dagshub.init(repo_owner=repo_owner, repo_name=repo_name, mlflow=True)
    except Exception as e:
        print(f"DagsHub initialization failed (check your credentials): {e}")
        print("Continuing with local MLflow tracking...")

    print("Training Random Forest Regressor...")
    with mlflow.start_run():
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)

        preds = model.predict(X_test)
        
        mae = mean_absolute_error(y_test, preds)
        r2 = r2_score(y_test, preds)
        
        print(f"Model trained! MAE: {mae:.2f}, R2: {r2:.2f}")

        # Export lightweight model file for Hugging Face Space inference
        joblib.dump(model, "model.pkl")
        print("Model exported to model.pkl for HF Space deployment.")

        mlflow.log_param("n_estimators", 100)
        mlflow.log_param("features", ", ".join(features))
        mlflow.log_metric("mae", mae)
        mlflow.log_metric("r2", r2)

        print("Logging and registering model to MLflow...")
        try:
            mlflow.sklearn.log_model(
                sk_model=model,
                artifact_path="model",
                registered_model_name="repo-growth-predictor"
            )
            print("Model successfully registered!")
        except Exception as e:
            print(f"Warning: Model registration failed (possibly no tracking server connection): {e}")

if __name__ == "__main__":
    main()
