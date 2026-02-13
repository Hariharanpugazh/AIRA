use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{EntityTrait, QueryFilter, ColumnTrait, ActiveModelTrait, Set};

use crate::entity::{agent_rooms, agents, projects};
use crate::models::agents::AgentRoomAssignment;
use crate::utils::jwt::Claims;
use crate::AppState;

/// Verify user owns the project
async fn verify_project_access(
    state: &AppState,
    project_id: &str,
    user_id: &str,
) -> Result<bool, StatusCode> {
    let project = projects::Entity::find_by_id(project_id)
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(project.user_id == user_id)
}

/// Verify user owns the agent through its project
async fn verify_agent_access(
    state: &AppState,
    agent_id: &str,
    user_id: &str,
) -> Result<bool, StatusCode> {
    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(agent_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    if let Some(project_id) = agent.project_id {
        verify_project_access(state, &project_id, user_id).await
    } else {
        Ok(false)
    }
}

pub async fn assign_agent_to_room(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(project_id): axum::extract::Path<String>,
    Json(req): Json<AgentRoomAssignment>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    // Find the agent
    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(&req.agent_id))
        .filter(agents::Column::ProjectId.eq(&project_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let agent_db_id = agent.id.clone();

    // Check if assignment already exists
    let existing = agent_rooms::Entity::find()
        .filter(agent_rooms::Column::AgentId.eq(agent_db_id.clone()))
        .filter(agent_rooms::Column::RoomName.eq(&req.room_name))
        .filter(agent_rooms::Column::LeftAt.is_null())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if existing.is_some() {
        return Err(StatusCode::CONFLICT);
    }

    // Create assignment
    let assignment_model = agent_rooms::ActiveModel {
        id: Set(uuid::Uuid::new_v4().to_string()),
        agent_id: Set(agent_db_id),
        instance_id: Set(req.instance_id),
        room_name: Set(req.room_name),
        joined_at: Set(Some(chrono::Utc::now().naive_utc())),
        ..Default::default()
    };

    assignment_model.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::CREATED)
}

pub async fn remove_agent_from_room(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((project_id, agent_id, room_name)): axum::extract::Path<(String, String, String)>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    // Find the agent
    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(agent_id))
        .filter(agents::Column::ProjectId.eq(project_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Find active assignment
    let assignment = agent_rooms::Entity::find()
        .filter(agent_rooms::Column::AgentId.eq(agent.id))
        .filter(agent_rooms::Column::RoomName.eq(room_name))
        .filter(agent_rooms::Column::LeftAt.is_null())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Update assignment
    let mut assignment: agent_rooms::ActiveModel = assignment.into();
    assignment.left_at = Set(Some(chrono::Utc::now().naive_utc()));

    assignment.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

pub async fn get_agent_room_assignments(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((project_id, agent_id)): axum::extract::Path<(String, String)>,
) -> Result<Json<Vec<AgentRoomAssignment>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    // Find the agent
    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(agent_id))
        .filter(agents::Column::ProjectId.eq(project_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Get assignments
    let assignments = agent_rooms::Entity::find()
        .filter(agent_rooms::Column::AgentId.eq(agent.id))
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response: Vec<AgentRoomAssignment> = assignments.into_iter().map(|assignment| AgentRoomAssignment {
        agent_id: agent.agent_id.clone(),
        room_name: assignment.room_name,
        instance_id: assignment.instance_id,
    }).collect();

    Ok(Json(response))
}

pub async fn get_room_agents(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((_project_id, room_name)): axum::extract::Path<(String, String)>,
) -> Result<Json<Vec<AgentRoomAssignment>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Note: This endpoint returns agents in a room across all projects
    // In a more strict isolation model, you'd filter by project

    // Get active assignments for the room
    let assignments = agent_rooms::Entity::find()
        .filter(agent_rooms::Column::RoomName.eq(room_name))
        .filter(agent_rooms::Column::LeftAt.is_null())
        .find_also_related(agents::Entity)
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response: Vec<AgentRoomAssignment> = assignments.into_iter()
        .filter_map(|(assignment, agent)| {
            agent.map(|a| AgentRoomAssignment {
                agent_id: a.agent_id,
                room_name: assignment.room_name,
                instance_id: assignment.instance_id,
            })
        })
        .collect();

    Ok(Json(response))
}
