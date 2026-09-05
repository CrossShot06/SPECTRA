from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json

router = APIRouter()

# Simple in-memory dict to manage rooms. 
# Key: room_id (str), Value: List of connected WebSockets
rooms: Dict[str, List[WebSocket]] = {}

@router.websocket("/ws/signaling/{room_id}")
async def signaling_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    
    if room_id not in rooms:
        rooms[room_id] = []
    rooms[room_id].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast the message to all *other* peers in the room
            for peer in rooms.get(room_id, []):
                if peer != websocket:
                    try:
                        await peer.send_text(data)
                    except Exception as e:
                        print(f"Error sending signaling data to peer in room {room_id}: {e}")
    except WebSocketDisconnect:
        # Clean up on disconnect
        if room_id in rooms and websocket in rooms[room_id]:
            rooms[room_id].remove(websocket)
            if not rooms[room_id]:
                del rooms[room_id] # Remove empty rooms
    except Exception as e:
        print(f"Signaling error in room {room_id}: {e}")
        if room_id in rooms and websocket in rooms[room_id]:
            rooms[room_id].remove(websocket)
            if not rooms[room_id]:
                del rooms[room_id]
