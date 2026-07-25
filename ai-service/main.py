import base64
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from services.ensemble_evaluator import EnsembleEvaluatorService

app = FastAPI(
    title="Digital Patrol AI Computer Vision Service",
    version="1.0.0",
    description="Microservice evaluating visual similarity between guard live patrol photos and point reference photos."
)

evaluator = EnsembleEvaluatorService()

class ValidationRequest(BaseModel):
    patrol_point_id: str = Field(..., description="UUID of target patrol point")
    live_photos_base64: List[str] = Field(..., description="Base64 encoded live camera photos")
    reference_photos_base64: List[str] = Field(..., description="Base64 encoded reference photos")

class ValidationResponse(BaseModel):
    status: str
    final_score: float
    pass_threshold: float
    metrics: dict
    execution_time_ms: int

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ai_computer_vision_engine"}

@app.post("/api/v1/ai/validate", response_model=ValidationResponse)
def validate_patrol_photos(payload: ValidationRequest):
    try:
        if not payload.live_photos_base64 or not payload.reference_photos_base64:
            raise HTTPException(status_code=400, detail="Both live and reference photo arrays are required.")
            
        # Decode base64 strings to bytes
        live_bytes_list = []
        for b64 in payload.live_photos_base64:
            # Strip data URI prefix if present
            if "," in b64:
                b64 = b64.split(",")[1]
            live_bytes_list.append(base64.b64decode(b64))

        ref_bytes_list = []
        for b64 in payload.reference_photos_base64:
            if "," in b64:
                b64 = b64.split(",")[1]
            ref_bytes_list.append(base64.b64decode(b64))

        result = evaluator.evaluate_patrol_photos(live_bytes_list, ref_bytes_list)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Evaluation Exception: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
