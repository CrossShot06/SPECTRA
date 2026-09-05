from fastapi import FastAPI
from app.api.endpoints.websockets.ws_routes import router as ws_router
from app.api.endpoints.websockets.signaling_routes import router as signaling_router
from app.api.endpoints.twilio_routes import router as twilio_router

app = FastAPI(title="Spectra Voice Verification")

app.include_router(ws_router)
app.include_router(signaling_router)
app.include_router(twilio_router)

@app.get("/")
async def health_check():
    return {"status": "online", "service": "Spectra Voice Verification"}