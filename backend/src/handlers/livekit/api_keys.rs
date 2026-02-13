use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryFilter, ColumnTrait};
use uuid::Uuid;

use crate::entity::api_keys;
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
        key_prefix: key.chars().take(12).collect(),
        secret_key: Some(secret),
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

    let keys = api_keys::Entity::find()
        .filter(api_keys::Column::IsActive.eq(true))
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = keys.into_iter().map(|k| ApiKeyResponse {
        id: k.id.to_string(),
        name: k.name,
        key: k.key.clone(),
        key_prefix: k.key.chars().take(12).collect(),
        secret_key: None,
        created_at: k.created_at.to_string(),
        is_active: k.is_active,
    }).collect();

    Ok(Json(response))
}

pub async fn delete_api_key(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let parsed_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let key = api_keys::Entity::find_by_id(parsed_id)
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if key.is_active {
        let mut active: api_keys::ActiveModel = key.into();
        active.is_active = Set(false);
        active.update(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok(StatusCode::NO_CONTENT)
}
