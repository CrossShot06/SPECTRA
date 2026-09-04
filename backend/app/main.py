from fastapi import FastAPI
from app.api.endpoints.websockets.ws_routes import router as ws_router

app = FastAPI(title="Spectra Voice Verification")

app.include_router(ws_router)

@app.get("/")
async def health_check():
    return {"status": "online", "service": "Spectra Voice Verification"}