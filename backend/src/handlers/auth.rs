use axum::{extract::State, Json};
use sea_orm::{
    ActiveModelTrait,
    ColumnTrait,
    DatabaseConnection,
    EntityTrait,
    QueryFilter,
    Set,
};

use crate::entity::users;
use crate::models::auth::{RegisterRequest, LoginRequest};
use crate::utils::password::{hash_password, verify_password};
use crate::utils::jwt::{create_jwt, decode_jwt};
use axum::http::HeaderMap;
use serde_json::json;
use uuid::Uuid;

// ---------------- REGISTER ----------------

pub async fn register(
    State(db): State<DatabaseConnection>,
    Json(payload): Json<RegisterRequest>,
) -> Json<String> {

    let existing_user = users::Entity::find()
        .filter(users::Column::Email.eq(&payload.email))
        .one(&db)
        .await
        .unwrap();

    if existing_user.is_some() {
        return Json("Email already exists".to_string());
    }

    let hashed_password = hash_password(&payload.password);

    let new_user = users::ActiveModel {
        email: Set(payload.email),
        password: Set(hashed_password),
        ..Default::default()
    };

    new_user.insert(&db).await.unwrap();

    Json("User registered".to_string())
}

// ---------------- LOGIN ----------------

pub async fn login(
    State(db): State<DatabaseConnection>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<String>, (axum::http::StatusCode, String)> {

    let user = users::Entity::find()
        .filter(users::Column::Email.eq(&payload.email))
        .one(&db)
        .await
        .unwrap();

    if user.is_none() {
        return Err((
            axum::http::StatusCode::UNAUTHORIZED,
            "Invalid email or password".to_string(),
        ));
    }

    let user = user.unwrap();

    if !verify_password(&user.password, &payload.password) {
        return Err((
            axum::http::StatusCode::UNAUTHORIZED,
            "Invalid email or password".to_string(),
        ));
    }

    let token = create_jwt(user.id.to_string());

    Ok(Json(token))
}

// ---------------- ME ----------------

pub async fn me(
    State(db): State<DatabaseConnection>,
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

    if let Ok(user_id) = Uuid::parse_str(&claims.sub) {
        if let Some(user) = users::Entity::find_by_id(user_id).one(&db).await.unwrap() {
            return Json(json!({"id": user.id.to_string(), "email": user.email}));
        }
    }

    Json(json!({"error": "User not found"}))
}
