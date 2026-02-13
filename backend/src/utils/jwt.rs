use axum::http::StatusCode;
use chrono::{Utc, Duration};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation};
use serde::{Serialize, Deserialize};
use std::env;
use std::collections::HashMap;

use axum::extract::Request;

pub async fn jwt_middleware(
    mut req: Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let auth_header = req.headers()
        .get("authorization")
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "));

    let cookie_token = req
        .headers()
        .get("cookie")
        .and_then(|header| header.to_str().ok())
        .and_then(extract_token_from_cookie_header);

    let query_token = req
        .uri()
        .query()
        .and_then(extract_token_from_query);

    let token = auth_header.or(cookie_token.as_deref()).or(query_token.as_deref());

    let token = match token {
        Some(token) if !token.trim().is_empty() => token,
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    let claims = match decode_jwt(token) {
        Some(claims) => claims,
        None => {
            return Err(StatusCode::UNAUTHORIZED);
        },
    };

    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub is_admin: bool,
    pub email: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LiveKitApiClaims {
    pub iss: String,
    pub exp: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<String>,
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
    env::var("JWT_SECRET").expect("JWT_SECRET environment variable must be set")
}

fn livekit_api_secret() -> String {
    env::var("LIVEKIT_API_SECRET").expect("LIVEKIT_API_SECRET must be set")
}

pub fn create_jwt(user_id: String, is_admin: bool, email: String, name: String) -> String {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("Failed to calculate JWT expiration time")
        .timestamp() as usize;

    let claims = Claims { sub: user_id, exp: expiration, is_admin, email, name };

    // Log claims for debugging so we can confirm the token contains the fields
    eprintln!("Creating JWT claims: {:?}", claims);

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

pub fn create_livekit_api_jwt(
    identity: Option<String>,
    name: Option<String>,
    metadata: Option<String>,
    video_grants: serde_json::Value,
    ingress_grants: serde_json::Value,
    egress_grants: serde_json::Value,
    sip_grants: serde_json::Value,
) -> Result<String, jsonwebtoken::errors::Error> {
    let api_key = env::var("LIVEKIT_API_KEY").expect("LIVEKIT_API_KEY must be set");
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(1))
        .expect("Failed to calculate LiveKit API JWT expiration time")
        .timestamp() as usize;

    let claims = LiveKitApiClaims {
        iss: api_key,
        exp: expiration,
        sub: identity,
        name,
        metadata,
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

fn extract_token_from_cookie_header(cookie_header: &str) -> Option<String> {
    cookie_header
        .split(';')
        .map(|part| part.trim())
        .find_map(|cookie| {
            let (key, value) = cookie.split_once('=')?;
            if key != "token" {
                return None;
            }
            urlencoding::decode(value).ok().map(|decoded| decoded.into_owned())
        })
}

fn extract_token_from_query(query: &str) -> Option<String> {
    let params: HashMap<String, String> =
        url::form_urlencoded::parse(query.as_bytes()).into_owned().collect();
    params.get("token").cloned()
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
