use axum::{http::{Request, StatusCode}, middleware::Next, response::Response, body::Body};
use chrono::{Utc, Duration};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation};
use serde::{Serialize, Deserialize};
use serde_json::json;
use std::env;

pub async fn jwt_middleware(
    mut req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let auth_header = req.headers()
        .get("authorization")
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "));

    let token = match auth_header {
        Some(token) => token,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let claims = match decode_jwt(token) {
        Some(claims) => claims,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub is_admin: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LiveKitApiClaims {
    pub iss: String,
    pub exp: usize,
    pub video: serde_json::Value,
    pub ingress: serde_json::Value,
    pub egress: serde_json::Value,
    pub sip: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentClaims {
    pub iss: String,
    pub sub: String,
    pub exp: usize,
    pub name: String,
    pub identity: String,
    pub room: Option<String>,
    pub metadata: Option<String>,
    pub video: serde_json::Value,
}

fn jwt_secret() -> String {
    env::var("JWT_SECRET").unwrap_or_else(|_| {
        eprintln!("Warning: JWT_SECRET not set, using default key. This is insecure for production!");
        "SUPER_SECRET_KEY".to_string()
    })
}

fn livekit_api_secret() -> String {
    env::var("LIVEKIT_API_SECRET").expect("LIVEKIT_API_SECRET must be set")
}

pub fn create_jwt(user_id: String, is_admin: bool) -> String {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("Failed to calculate JWT expiration time")
        .timestamp() as usize;

    let claims = Claims { sub: user_id, exp: expiration, is_admin };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_ref()),
    )
    .expect("Failed to encode JWT")
}

pub fn decode_jwt(token: &str) -> Option<Claims> {
    let validation = Validation::default();
    match decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_ref()),
        &validation,
    ) {
        Ok(data) => Some(data.claims),
        Err(_) => None,
    }
}

pub fn create_livekit_api_jwt(video_grants: serde_json::Value, ingress_grants: serde_json::Value, egress_grants: serde_json::Value, sip_grants: serde_json::Value) -> Result<String, jsonwebtoken::errors::Error> {
    let api_key = env::var("LIVEKIT_API_KEY").expect("LIVEKIT_API_KEY must be set");
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(1))
        .expect("Failed to calculate LiveKit API JWT expiration time")
        .timestamp() as usize;

    let claims = LiveKitApiClaims {
        iss: api_key,
        exp: expiration,
        video: video_grants,
        ingress: ingress_grants,
        egress: egress_grants,
        sip: sip_grants,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(livekit_api_secret().as_ref()),
    )
}

pub fn create_agent_jwt(identity: String, name: String, room: Option<String>, metadata: Option<String>, video_grants: serde_json::Value) -> Result<String, jsonwebtoken::errors::Error> {
    let api_key = env::var("LIVEKIT_API_KEY").expect("LIVEKIT_API_KEY must be set");
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("Failed to calculate agent JWT expiration time")
        .timestamp() as usize;

    let claims = AgentClaims {
        iss: api_key,
        sub: format!("agent:{}", identity),
        exp: expiration,
        name,
        identity,
        room,
        metadata,
        video: video_grants,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(livekit_api_secret().as_ref()),
    )
}
