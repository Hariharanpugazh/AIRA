use axum::{extract::{State, Query}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::utils::jwt::{Claims, create_livekit_api_jwt};
use crate::AppState;

#[derive(Deserialize)]
pub struct TokenRequest {
    pub room_name: String,
    pub identity: Option<String>,
    pub can_publish: Option<bool>,
    pub can_subscribe: Option<bool>,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub ws_url: String,
    pub room: String,
    pub identity: String,
}

pub async fn generate_token(
    State(_state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<TokenRequest>,
) -> Result<Json<TokenResponse>, StatusCode> {
    let identity = req.identity.unwrap_or_else(|| claims.sub.clone());
    
    // Admin grants for dashboard users - provides full LiveKit Cloud parity
    let video_grants = json!({
        "roomCreate": claims.is_admin,
        "roomList": claims.is_admin,
        "roomJoin": true,
        "room": req.room_name,
        "roomAdmin": claims.is_admin,
        "canPublish": req.can_publish.unwrap_or(true),
        "canSubscribe": req.can_subscribe.unwrap_or(true),
        "canUpdateOwnMetadata": true,
        "ingressAdmin": claims.is_admin,
    });

    let token = create_livekit_api_jwt(
        video_grants,
        json!({}),
        json!({}),
        json!({})
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ws_url = std::env::var("LIVEKIT_URL")
        .unwrap_or_else(|_| "ws://localhost:7880".to_string())
        .replace("http://", "ws://")
        .replace("https://", "wss://");

    Ok(Json(TokenResponse {
        token,
        ws_url,
        room: req.room_name,
        identity,
    }))
}

#[derive(Deserialize)]
pub struct TokenQuery {
    pub identity: Option<String>,
    pub room: Option<String>,
}

pub async fn get_token(
    State(_state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Query(query): Query<TokenQuery>,
) -> Result<Json<TokenResponse>, StatusCode> {
    let identity = query.identity.unwrap_or_else(|| claims.sub.clone());
    let room_name = query.room.unwrap_or_else(|| "default-room".to_string());
    
    // Admin grants for dashboard users
    let video_grants = json!({
        "roomCreate": claims.is_admin,
        "roomList": claims.is_admin,
        "roomJoin": true,
        "room": room_name,
        "roomAdmin": claims.is_admin,
        "canPublish": true,
        "canSubscribe": true,
        "canUpdateOwnMetadata": true,
        "ingressAdmin": claims.is_admin,
    });

    let token = create_livekit_api_jwt(
        video_grants,
        json!({}),
        json!({}),
        json!({})
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ws_url = std::env::var("LIVEKIT_URL")
        .unwrap_or_else(|_| "ws://localhost:7880".to_string())
        .replace("http://", "ws://")
        .replace("https://", "wss://");

    Ok(Json(TokenResponse {
        token,
        ws_url,
        room: room_name,
        identity,
    }))
}
