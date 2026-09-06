from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json

router = APIRouter()

rooms: Dict[str, List[WebSocket]] = {}

@router.websocket("/ws/signaling/{room_id}")
async def signaling_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    
    if room_id not in rooms:
        rooms[room_id] = []
    rooms[room_id].append(websocket)

    # Assign a definite role based on join order — prevents both peers
    # from creating an SDP offer simultaneously ("glare")
    is_first = len(rooms[room_id]) == 1
    role = "offerer" if is_first else "answerer"
    await websocket.send_text(json.dumps({"type": "role", "role": role}))
    print(f"Room {room_id}: assigned role '{role}' (peer #{len(rooms[room_id])})")

    try:
        while True:
            data = await websocket.receive_text()
            for peer in rooms.get(room_id, []):
                if peer != websocket:
                    try:
                        await peer.send_text(data)
                    except Exception as e:
                        print(f"Error sending signaling data to peer in room {room_id}: {e}")
    except WebSocketDisconnect:
        if room_id in rooms and websocket in rooms[room_id]:
            rooms[room_id].remove(websocket)
            if not rooms[room_id]:
                del rooms[room_id]
    except Exception as e:
        print(f"Signaling error in room {room_id}: {e}")
        if room_id in rooms and websocket in rooms[room_id]:
            rooms[room_id].remove(websocket)
            if not rooms[room_id]:
                del rooms[room_id]