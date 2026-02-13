use axum::{routing::{post, get, delete}, Router, middleware};
use crate::handlers::livekit::{api_keys, health, rooms, token};
use crate::utils::jwt::jwt_middleware;

pub fn routes() -> Router<crate::AppState> {
    Router::new()
        .route("/api/livekit", get(health::api_info))
        .route("/api/livekit/api-keys", post(api_keys::create_api_key))
        .route("/api/livekit/api-keys", get(api_keys::list_api_keys))
        .route("/api/livekit/health", get(health::check_health))
        // Room management
        .route("/api/livekit/rooms", post(rooms::create_room))
        .route("/api/livekit/rooms", get(rooms::list_rooms))
        .route("/api/livekit/rooms/:room_name", get(rooms::get_room_detail).delete(rooms::delete_room))
        // Participant management
        .route("/api/livekit/rooms/:room_name/participants", get(rooms::list_participants))
        .route("/api/livekit/rooms/:room_name/participants/:identity", delete(rooms::remove_participant))
        .route("/api/livekit/rooms/:room_name/participants/:identity/mute", post(rooms::mute_participant))
        .route("/api/livekit/rooms/:room_name/participants/:identity/update", post(rooms::update_participant))
        // Stats and tokens
        .route("/api/livekit/stats", get(rooms::get_livekit_stats))
        .route("/api/livekit/token", get(token::get_token))
        .route("/api/livekit/token", post(token::generate_token))
        .layer(middleware::from_fn(jwt_middleware))
}