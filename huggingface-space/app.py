from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import os

app = FastAPI(title="GitHub Analytics ML Inference")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model at startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
model = None
try:
    model = joblib.load(MODEL_PATH)
    print(f"Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    print(f"Warning: Could not load model: {e}")


class PredictionInput(BaseModel):
    stars: float
    forks: float
    contributors: float
    commit_frequency: float


@app.get("/")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict")
def predict(input: PredictionInput):
    if model is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Model not loaded. Run ML training pipeline first.")

    # Feature order must match train_model.py: stars, forks, contributors_count, commit_frequency
    features = np.array([[
        input.stars,
        input.forks,
        input.contributors,
        input.commit_frequency,
    ]])
    prediction = model.predict(features)[0]
    return {"predicted_stars_next_month": float(prediction)}
