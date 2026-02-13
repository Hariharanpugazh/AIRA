use axum::{extract::{State, Path}, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryOrder, ColumnTrait, QueryFilter};
use uuid::Uuid;
use chrono::Utc;

use crate::entity::{projects, project_ai_configs, prelude::*};
use crate::models::projects::{CreateProjectRequest, UpdateProjectRequest, ProjectResponse, UpdateAIConfigRequest, AIConfigResponse};
use crate::utils::jwt::Claims;
use crate::AppState;

fn map_project_to_response(project: projects::Model) -> ProjectResponse {
    ProjectResponse {
        id: project.id,
        short_id: Some(project.short_id),
        user_id: Some(project.user_id),
        name: project.name,
        description: project.description,
        status: project.status,
        created_at: project.created_at.map(|t| t.to_string()).unwrap_or_default(),
        updated_at: project.updated_at.map(|t| t.to_string()).unwrap_or_default(),
    }
}

pub async fn list_projects(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<ProjectResponse>>, StatusCode> {
    let projects_list = Projects::find()
        .filter(projects::Column::UserId.eq(claims.sub.clone()))
        .order_by_desc(projects::Column::CreatedAt)
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = projects_list.into_iter().map(map_project_to_response).collect();
    Ok(Json(response))
}

pub async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<ProjectResponse>, StatusCode> {
    let project = Projects::find_by_id(id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if project.user_id != claims.sub {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(map_project_to_response(project)))
}

pub async fn create_project(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<Json<ProjectResponse>, StatusCode> {
    let short_id = Uuid::new_v4().simple().to_string()[..8].to_string();

    let new_project = projects::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        name: Set(payload.name),
        description: Set(payload.description),
        user_id: Set(claims.sub.clone()),
        short_id: Set(short_id),
        status: Set("active".to_string()),
        created_at: Set(Some(Utc::now().naive_utc())),
        updated_at: Set(Some(Utc::now().naive_utc())),
        ..Default::default()
    };

    let saved_project = new_project.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Create default AI config
    let ai_config = project_ai_configs::ActiveModel {
        project_id: Set(saved_project.id.clone()),
        stt_mode: Set(Some("cloud".to_string())),
        stt_provider: Set(Some("google".to_string())),
        tts_mode: Set(Some("cloud".to_string())),
        tts_provider: Set(Some("google".to_string())),
        llm_mode: Set(Some("cloud".to_string())),
        llm_provider: Set(Some("openai".to_string())),
        ..Default::default()
    };
    ai_config.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(map_project_to_response(saved_project)))
}

pub async fn update_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>, StatusCode> {
    let project = Projects::find_by_id(id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if project.user_id != claims.sub {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut active_model: projects::ActiveModel = project.into();

    if let Some(name) = payload.name {
        active_model.name = Set(name);
    }
    if let Some(desc) = payload.description {
        active_model.description = Set(Some(desc));
    }
    if let Some(status) = payload.status {
        active_model.status = Set(status);
    }
    active_model.updated_at = Set(Some(Utc::now().naive_utc()));

    let updated_project = active_model.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(map_project_to_response(updated_project)))
}

pub async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<StatusCode, StatusCode> {
    let project = Projects::find_by_id(id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if project.user_id != claims.sub {
        return Err(StatusCode::NOT_FOUND);
    }

    Projects::delete_by_id(id)
        .exec(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_ai_config(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<AIConfigResponse>, StatusCode> {
    let project = Projects::find_by_id(project_id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if project.user_id != claims.sub {
        return Err(StatusCode::NOT_FOUND);
    }

    let config = ProjectAIConfigs::find_by_id(project_id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(AIConfigResponse {
        project_id: config.project_id,
        stt_mode: config.stt_mode,
        stt_provider: config.stt_provider,
        stt_model: config.stt_model,
        tts_mode: config.tts_mode,
        tts_provider: config.tts_provider,
        tts_model: config.tts_model,
        tts_voice: config.tts_voice,
        llm_mode: config.llm_mode,
        llm_provider: config.llm_provider,
        llm_model: config.llm_model,
    }))
}

pub async fn update_ai_config(
    State(state): State<AppState>,
    Path(project_id): Path<String>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(payload): Json<UpdateAIConfigRequest>,
) -> Result<Json<AIConfigResponse>, StatusCode> {
    let project = Projects::find_by_id(project_id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if project.user_id != claims.sub {
        return Err(StatusCode::NOT_FOUND);
    }

    let config = ProjectAIConfigs::find_by_id(project_id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let mut active_model: project_ai_configs::ActiveModel = config.into();

    if let Some(v) = payload.stt_mode { active_model.stt_mode = Set(Some(v)); }
    if let Some(v) = payload.stt_provider { active_model.stt_provider = Set(Some(v)); }
    if let Some(v) = payload.stt_model { active_model.stt_model = Set(Some(v)); }
    if let Some(v) = payload.tts_mode { active_model.tts_mode = Set(Some(v)); }
    if let Some(v) = payload.tts_provider { active_model.tts_provider = Set(Some(v)); }
    if let Some(v) = payload.tts_model { active_model.tts_model = Set(Some(v)); }
    if let Some(v) = payload.tts_voice { active_model.tts_voice = Set(Some(v)); }
    if let Some(v) = payload.llm_mode { active_model.llm_mode = Set(Some(v)); }
    if let Some(v) = payload.llm_provider { active_model.llm_provider = Set(Some(v)); }
    if let Some(v) = payload.llm_model { active_model.llm_model = Set(Some(v)); }

    let updated_config = active_model.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AIConfigResponse {
        project_id: updated_config.project_id,
        stt_mode: updated_config.stt_mode,
        stt_provider: updated_config.stt_provider,
        stt_model: updated_config.stt_model,
        tts_mode: updated_config.tts_mode,
        tts_provider: updated_config.tts_provider,
        tts_model: updated_config.tts_model,
        tts_voice: updated_config.tts_voice,
        llm_mode: updated_config.llm_mode,
        llm_provider: updated_config.llm_provider,
        llm_model: updated_config.llm_model,
    }))
}
