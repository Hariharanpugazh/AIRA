use axum::{extract::State, Json};
use sea_orm::{
    ActiveModelTrait,
    ColumnTrait,
    EntityTrait,
    QueryFilter,
    Set,
};
use uuid::Uuid;

use crate::entity::users;
use crate::AppState;
use crate::models::auth::{RegisterRequest, LoginRequest};
use crate::utils::password::{hash_password, verify_password};
use crate::utils::jwt::{create_jwt, decode_jwt};
use axum::http::HeaderMap;
use serde_json::json;

// ---------------- REGISTER ----------------

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Json<String> {

    let existing_user = users::Entity::find()
        .filter(users::Column::Email.eq(&payload.email))
        .one(&state.db)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string()))?;

    if existing_user.is_some() {
        return Json("Email already exists".to_string());
    }

    let hashed_password = hash_password(&payload.password);

    let user_id = Uuid::new_v4().to_string();

    let new_user = users::ActiveModel {
        id: Set(user_id),
        email: Set(payload.email),
        password: Set(hashed_password),
        ..Default::default()
    };

    new_user.insert(&state.db).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create user".to_string()))?;

    Json("User registered".to_string())
}

// ---------------- LOGIN ----------------

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<String>, (axum::http::StatusCode, String)> {

    let user = users::Entity::find()
        .filter(users::Column::Email.eq(&payload.email))
        .one(&state.db)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string()))?;

    if user.is_none() {
        return Err((
            axum::http::StatusCode::UNAUTHORIZED,
            "Invalid email or password".to_string(),
        ));
    }

    let user = user.ok_or((axum::http::StatusCode::UNAUTHORIZED, "Invalid email or password".to_string()))?;

    if !verify_password(&user.password, &payload.password) {
        return Err((
            axum::http::StatusCode::UNAUTHORIZED,
            "Invalid email or password".to_string(),
        ));
    }

    let token = create_jwt(user.id, true); // All users are admins for now

    Ok(Json(token))
}

// ---------------- ME ----------------

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Json<serde_json::Value> {

    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !auth.starts_with("Bearer ") {
        return Json(json!({"error": "Missing token"}));
    }

    let token = auth.trim_start_matches("Bearer ").trim();

    let claims = match decode_jwt(token) {
        Some(c) => c,
        None => return Json(json!({"error": "Invalid token"})),
    };

    // Since we're using string IDs directly, find by ID as string
    let user_result = users::Entity::find_by_id(&claims.sub).one(&state.db).await.map_err(|_| Json(json!({"error": "Database error"})))?;
    if let Some(user) = user_result {
        return Json(json!({"id": user.id, "email": user.email}));
    }

    Json(json!({"error": "User not found"}))
}
