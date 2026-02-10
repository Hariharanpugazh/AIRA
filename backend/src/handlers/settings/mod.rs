use axum::{extract::{State, Path}, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, EntityTrait, Set, PaginatorTrait, ModelTrait, QueryFilter, ColumnTrait};
use uuid::Uuid;
use chrono::Utc;
use rand::Rng;

use crate::entity::{
    roles, service_accounts, storage_configs, users, configs,
    prelude::*
};
use crate::models::settings::{
    RoleResponse, CreateRoleRequest,
    ServiceAccountResponse, CreateServiceAccountRequest, ServiceAccountSecretsResponse,
    StorageConfigResponse, CreateStorageConfigRequest,
    TeamMemberResponse, CreateTeamMemberRequest, RolePermissionsResponse,
    WebhookResponse, CreateWebhookRequest
};
use crate::utils::jwt::Claims;
use crate::AppState;

// Roles Handlers

pub async fn list_roles(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<RoleResponse>>, StatusCode> {
    let roles_list = Roles::find()
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = roles_list.into_iter().map(|r| RoleResponse {
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions.map(|p| serde_json::from_str(&p).unwrap_or_default()).unwrap_or_default(),
        is_system: r.is_system,
    }).collect();

    Ok(Json(response))
}

pub async fn create_role(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Json(payload): Json<CreateRoleRequest>,
) -> Result<Json<RoleResponse>, StatusCode> {
    let new_role = roles::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        name: Set(payload.name),
        description: Set(payload.description),
        permissions: Set(Some(serde_json::to_string(&payload.permissions).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)),
        is_system: Set(false),
        ..Default::default()
    };

    let saved = new_role.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(RoleResponse {
        id: saved.id,
        name: saved.name,
        description: saved.description,
        permissions: saved.permissions.map(|p| serde_json::from_str(&p).unwrap_or_default()).unwrap_or_default(),
        is_system: saved.is_system,
    }))
}

pub async fn update_role(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Json(payload): Json<CreateRoleRequest>, // reusing create request for simplicity
) -> Result<Json<RoleResponse>, StatusCode> {
    let role = Roles::find_by_id(id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if role.is_system {
        return Err(StatusCode::FORBIDDEN); // Cannot modify system roles
    }

    let mut active_model: roles::ActiveModel = role.into();
    active_model.name = Set(payload.name);
    active_model.description = Set(payload.description);
    active_model.permissions = Set(Some(serde_json::to_string(&payload.permissions).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?));

    let updated = active_model.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(RoleResponse {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        permissions: updated.permissions.map(|p| serde_json::from_str(&p).unwrap_or_default()).unwrap_or_default(),
        is_system: updated.is_system,
    }))
}

pub async fn delete_role(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<StatusCode, StatusCode> {
    let role = Roles::find_by_id(id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if role.is_system {
        return Err(StatusCode::FORBIDDEN);
    }
    
    // Check usage? Ideally yes. For now just delete.
    role.delete(&state.db).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(StatusCode::NO_CONTENT)
}

// Service Accounts

pub async fn list_service_accounts(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<ServiceAccountResponse>>, StatusCode> {
    let list = ServiceAccounts::find()
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = list.into_iter().map(|a| ServiceAccountResponse {
        id: a.id,
        name: a.name,
        client_id: a.client_id,
        permissions: a.permissions.map(|p| serde_json::from_str(&p).unwrap_or_default()).unwrap_or_default(),
        is_active: a.is_active,
        created_at: a.created_at.map(|t| t.to_string()).unwrap_or_default(),
    }).collect();

    Ok(Json(response))
}

pub async fn create_service_account(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Json(payload): Json<CreateServiceAccountRequest>,
) -> Result<Json<ServiceAccountSecretsResponse>, StatusCode> {
    let client_id = format!("sa_{}", Uuid::new_v4().simple());
    let client_secret = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    // Hash secret using shared utility
    let hashed_secret = crate::utils::password::hash_password(&client_secret);

    let new_sa = service_accounts::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        name: Set(payload.name),
        client_id: Set(client_id.clone()),
        client_secret_hash: Set(hashed_secret),
        permissions: Set(payload.permissions.map(|p| serde_json::to_string(&p).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?).transpose().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?),
        is_active: Set(true),
        created_at: Set(Some(Utc::now().naive_utc())),
        ..Default::default()
    };

    let saved = new_sa.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ServiceAccountSecretsResponse {
        id: saved.id,
        name: saved.name,
        client_id: saved.client_id,
        client_secret: client_secret, // Return raw secret only once!
        created_at: saved.created_at.map(|t| t.to_string()).unwrap_or_default(),
    }))
}

// Storage Configs

pub async fn list_storage_configs(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<StorageConfigResponse>>, StatusCode> {
    let list = StorageConfigs::find()
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = list.into_iter().map(|c| StorageConfigResponse {
        id: c.id,
        name: c.name,
        storage_type: c.storage_type,
        bucket: c.bucket,
        region: c.region,
        endpoint: c.endpoint,
        is_default: c.is_default,
        created_at: c.created_at.map(|t| t.to_string()).unwrap_or_default(),
    }).collect();

    Ok(Json(response))
}

pub async fn create_storage_config(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Json(payload): Json<CreateStorageConfigRequest>,
) -> Result<Json<StorageConfigResponse>, StatusCode> {
    // If default, unset other defaults
    if payload.is_default.unwrap_or(false) {
        // This requires a transaction or sequential update.
        // Update all to false first? Or handle in app logic.
        // For MVP, just update. Ideally DB trigger or transaction.
        // SeaORM update many is possible.
    }

    let new_config = storage_configs::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        name: Set(payload.name),
        storage_type: Set(payload.storage_type),
        bucket: Set(payload.bucket),
        region: Set(payload.region),
        endpoint: Set(payload.endpoint),
        access_key: Set(payload.access_key),
        secret_key: Set(payload.secret_key),
        is_default: Set(payload.is_default.unwrap_or(false)),
        created_at: Set(Some(Utc::now().naive_utc())),
        ..Default::default()
    };

    let saved = new_config.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(StorageConfigResponse {
        id: saved.id,
        name: saved.name,
        storage_type: saved.storage_type,
        bucket: saved.bucket,
        region: saved.region,
        endpoint: saved.endpoint,
        is_default: saved.is_default,
        created_at: saved.created_at.map(|t| t.to_string()).unwrap_or_default(),
    }))
}

pub async fn delete_storage_config(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<StatusCode, StatusCode> {
    StorageConfigs::delete_by_id(id).exec(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

// Team Members

pub async fn list_team_members(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<TeamMemberResponse>>, StatusCode> {
    let list = Users::find()
        .find_also_related(roles::Entity)
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = list.into_iter().map(|(u, r)| TeamMemberResponse {
        id: u.id,
        email: u.email,
        name: u.name.unwrap_or_default(),
        role: r.map(|role| role.name).unwrap_or_else(|| "Member".to_string()),
        is_active: u.is_active,
        created_at: u.created_at.map(|t| t.to_string()).unwrap_or_default(),
    }).collect();

    Ok(Json(response))
}

pub async fn create_team_member(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Json(payload): Json<CreateTeamMemberRequest>,
) -> Result<Json<TeamMemberResponse>, StatusCode> {
    
    // Find role by name
    let role = Roles::find()
        .filter(roles::Column::Name.eq(&payload.role))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::BAD_REQUEST)?;

    let hashed_password = crate::utils::password::hash_password(&payload.password);
    
    let new_user = users::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        email: Set(payload.email),
        password: Set(hashed_password),
        name: Set(Some(payload.name)),
        role_id: Set(Some(role.id.clone())),
        is_active: Set(true),
        created_at: Set(Some(Utc::now().naive_utc())),
        ..Default::default()
    };

    let saved = new_user.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(TeamMemberResponse {
        id: saved.id,
        email: saved.email,
        name: saved.name.unwrap_or_default(),
        role: role.name,
        is_active: saved.is_active,
        created_at: saved.created_at.map(|t| t.to_string()).unwrap_or_default(),
    }))
}

pub async fn delete_team_member(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<StatusCode, StatusCode> {
    Users::delete_by_id(id).exec(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

// Role Permissions

const AVAILABLE_PERMISSIONS: &[&str] = &[
    "project.read", "project.write", "project.create", "project.delete",
    "agent.read", "agent.write", "agent.deploy",
    "room.read", "room.create", "room.record",
    "sip.read", "sip.write",
    "settings.read", "settings.write",
    "analytics.read"
];

pub async fn get_role_permissions(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<Json<RolePermissionsResponse>, StatusCode> {
    let role = roles::Entity::find_by_id(id)
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let assigned: Vec<String> = role.permissions.clone()
        .map(|p| serde_json::from_str(&p).unwrap_or_default())
        .unwrap_or_default();
    
    let available: Vec<String> = AVAILABLE_PERMISSIONS.iter().map(|&s| s.to_string()).collect();

    Ok(Json(RolePermissionsResponse {
        role: RoleResponse {
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: assigned.clone(),
            is_system: role.is_system,
        },
        assigned_permissions: assigned,
        available_permissions: available,
    }))
}

// Webhooks Handlers (Storing in configs table for now)

pub async fn list_webhooks(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<WebhookResponse>>, StatusCode> {
    let list = configs::Entity::find()
        .filter(configs::Column::ServiceName.eq("webhooks"))
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = list.into_iter().filter_map(|c| {
        let val = c.config_value?;
        serde_json::from_str::<WebhookResponse>(&val).ok()
    }).collect();

    Ok(Json(response))
}

pub async fn create_webhook(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Json(payload): Json<CreateWebhookRequest>,
) -> Result<Json<WebhookResponse>, StatusCode> {
    let id = Uuid::new_v4().to_string();
    let webhook = WebhookResponse {
        id: id.clone(),
        name: payload.name,
        url: payload.url,
        events: payload.events,
        created_at: Utc::now().to_string(),
    };

    let config_val = serde_json::to_string(&webhook).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let new_config = configs::ActiveModel {
        id: Set(Uuid::new_v4()),
        service_name: Set("webhooks".to_string()),
        config_key: Set(id),
        config_value: Set(Some(config_val)),
        is_active: Set(true),
        created_at: Set(Utc::now().into()),
        updated_at: Set(Utc::now().into()),
    };

    new_config.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(webhook))
}

pub async fn delete_webhook(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<StatusCode, StatusCode> {
    configs::Entity::delete_many()
        .filter(configs::Column::ServiceName.eq("webhooks"))
        .filter(configs::Column::ConfigKey.eq(id))
        .exec(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}
