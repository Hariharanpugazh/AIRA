use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use crate::AppState;
use crate::utils::jwt::Claims;
use axum::extract::Extension;

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state, claims))
}

async fn handle_socket(socket: WebSocket, _state: AppState, _claims: Claims) {
    let (mut sender, mut receiver) = socket.split();

    // Send initial connection message
    if sender.send(Message::Text("Connected to LiveKit Admin WebSocket".to_string())).await.is_err() {
        return;
    }

    // Listen for messages and send updates
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                // Handle client messages if needed
                println!("Received: {}", text);
            }
            Ok(Message::Close(_)) => {
                println!("WebSocket closed");
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