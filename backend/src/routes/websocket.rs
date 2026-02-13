use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use crate::AppState;
use crate::utils::jwt::Claims;
use axum::extract::Extension;
use serde_json::json;
use chrono::Utc;

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state, claims))
}

async fn handle_socket(socket: WebSocket, state: AppState, claims: Claims) {
    let (mut sender, mut receiver) = socket.split();

    let connected_payload = json!({
        "type": "connected",
        "data": {
            "user_id": claims.sub,
            "is_admin": claims.is_admin
        },
        "timestamp": Utc::now().to_rfc3339()
    });

    if sender
        .send(Message::Text(connected_payload.to_string()))
        .await
        .is_err()
    {
        return;
    }

    if let Ok(rooms) = state.lk_service.list_rooms().await {
        let rooms_payload = json!({
            "type": "rooms_list",
            "data": {
                "rooms": rooms.into_iter().map(|room| json!({
                    "sid": room.sid,
                    "name": room.name,
                    "num_participants": room.num_participants,
                    "creation_time": room.creation_time,
                    "active_recording": room.active_recording
                })).collect::<Vec<_>>()
            },
            "timestamp": Utc::now().to_rfc3339()
        });

        if sender
            .send(Message::Text(rooms_payload.to_string()))
            .await
            .is_err()
        {
            return;
        }
    }

    // Listen for messages and send updates
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                let parsed = serde_json::from_str::<serde_json::Value>(&text);
                let response = match parsed {
                    Ok(payload) => json!({
                        "type": "ack",
                        "data": {
                            "received": payload
                        },
                        "timestamp": Utc::now().to_rfc3339()
                    }),
                    Err(_) => json!({
                        "type": "error",
                        "data": {
                            "message": "invalid_json_message"
                        },
                        "timestamp": Utc::now().to_rfc3339()
                    }),
                };

                if sender
                    .send(Message::Text(response.to_string()))
                    .await
                    .is_err()
                {
                    break;
                }
            }
            Ok(Message::Close(_)) => {
                break;
            }
            Err(e) => {
                println!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}
