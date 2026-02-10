use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use uuid::Uuid;

use crate::entity::{api_keys, prelude::*};
use crate::models::livekit::{CreateApiKeyRequest, ApiKeyResponse};
use crate::utils::jwt::Claims;
use crate::AppState;

pub async fn create_api_key(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<CreateApiKeyRequest>,
) -> Result<Json<ApiKeyResponse>, StatusCode> {
    // Only admin can create API keys
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let key = format!("lk_{}", Uuid::new_v4().simple());
    let secret = format!("sk_{}", Uuid::new_v4().simple());
    let secret_hash = crate::utils::password::hash_password(&secret);

    let api_key = api_keys::ActiveModel {
        name: Set(req.name),
        key: Set(key.clone()),
        secret_hash: Set(secret_hash),
        secret: Set(Some(secret.clone())), // Store the actual secret for livekit.yaml
        ..Default::default()
    };

    let result = api_key.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ApiKeyResponse {
        id: result.id.to_string(),
        name: result.name,
        key: key.clone(),
        created_at: result.created_at.to_string(),
        is_active: result.is_active,
    }))
}

pub async fn list_api_keys(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<ApiKeyResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let keys = api_keys::Entity::find().all(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = keys.into_iter().map(|k| ApiKeyResponse {
        id: k.id.to_string(),
        name: k.name,
        key: k.key,
        created_at: k.created_at.to_string(),
        is_active: k.is_active,
    }).collect();

    Ok(Json(response))
}