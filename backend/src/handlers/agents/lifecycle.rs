use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{EntityTrait, QueryFilter, ColumnTrait, ActiveModelTrait, Set};
use tokio::process::Command as TokioCommand;

use crate::entity::{agents, agent_instances};
use crate::models::agents::AgentInstanceResponse;
use crate::utils::jwt::Claims;
use crate::AppState;

pub async fn start_agent(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(instance_id): axum::extract::Path<String>,
) -> Result<Json<AgentInstanceResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let instance = agent_instances::Entity::find()
        .filter(agent_instances::Column::InstanceId.eq(instance_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if instance.status == "running" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Start the container or process
    let result = if let Some(container_id) = &instance.container_id {
        start_docker_container(container_id).await
    } else if let Some(_pid) = instance.process_pid {
        // For processes, we need to restart them
        restart_process(&state, &instance).await
    } else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    if result.is_err() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Update instance status
    let mut instance: agent_instances::ActiveModel = instance.into();
    instance.status = Set("running".to_string());
    instance.started_at = Set(Some(chrono::Utc::now().naive_utc()));
    instance.stopped_at = Set(None);
    instance.exit_code = Set(None);
    instance.crash_reason = Set(None);

    let result = instance.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AgentInstanceResponse {
        id: result.id,
        instance_id: result.instance_id,
        agent_id: result.agent_id,
        status: result.status,
        container_id: result.container_id,
        process_pid: result.process_pid,
        last_heartbeat: result.last_heartbeat.map(|dt| dt.to_string()),
        exit_code: result.exit_code,
        crash_reason: result.crash_reason,
        started_at: result.started_at.map(|dt| dt.to_string()),
        stopped_at: result.stopped_at.map(|dt| dt.to_string()),
    }))
}

pub async fn stop_agent(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(instance_id): axum::extract::Path<String>,
) -> Result<Json<AgentInstanceResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let instance = agent_instances::Entity::find()
        .filter(agent_instances::Column::InstanceId.eq(instance_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if instance.status == "stopped" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Stop the container or process
    let result = if let Some(container_id) = &instance.container_id {
        stop_docker_container(container_id).await
    } else if let Some(pid) = instance.process_pid {
        stop_process(pid).await
    } else {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    };

    if result.is_err() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Update instance status
    let mut instance: agent_instances::ActiveModel = instance.into();
    instance.status = Set("stopped".to_string());
    instance.stopped_at = Set(Some(chrono::Utc::now().naive_utc()));

    let result = instance.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AgentInstanceResponse {
        id: result.id,
        instance_id: result.instance_id,
        agent_id: result.agent_id,
        status: result.status,
        container_id: result.container_id,
        process_pid: result.process_pid,
        last_heartbeat: result.last_heartbeat.map(|dt| dt.to_string()),
        exit_code: result.exit_code,
        crash_reason: result.crash_reason,
        started_at: result.started_at.map(|dt| dt.to_string()),
        stopped_at: result.stopped_at.map(|dt| dt.to_string()),
    }))
}

pub async fn restart_agent(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(instance_id): axum::extract::Path<String>,
) -> Result<Json<AgentInstanceResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let instance = agent_instances::Entity::find()
        .filter(agent_instances::Column::InstanceId.eq(instance_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Stop first
    if instance.status == "running" {
        let stop_result = if let Some(container_id) = &instance.container_id {
            stop_docker_container(container_id).await
        } else if let Some(pid) = instance.process_pid {
            stop_process(pid).await
        } else {
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        };

        if stop_result.is_err() {
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Start again
    let start_result = if let Some(container_id) = &instance.container_id {
        start_docker_container(container_id).await
    } else {
        restart_process(&state, &instance).await
    };

    if start_result.is_err() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Update instance status
    let mut instance: agent_instances::ActiveModel = instance.into();
    instance.status = Set("running".to_string());
    instance.started_at = Set(Some(chrono::Utc::now().naive_utc()));
    instance.stopped_at = Set(None);
    instance.exit_code = Set(None);
    instance.crash_reason = Set(None);

    let result = instance.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AgentInstanceResponse {
        id: result.id,
        instance_id: result.instance_id,
        agent_id: result.agent_id,
        status: result.status,
        container_id: result.container_id,
        process_pid: result.process_pid,
        last_heartbeat: result.last_heartbeat.map(|dt| dt.to_string()),
        exit_code: result.exit_code,
        crash_reason: result.crash_reason,
        started_at: result.started_at.map(|dt| dt.to_string()),
        stopped_at: result.stopped_at.map(|dt| dt.to_string()),
    }))
}

pub async fn list_agent_instances(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<AgentInstanceResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let instances = agent_instances::Entity::find()
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response: Vec<AgentInstanceResponse> = instances.into_iter().map(|instance| AgentInstanceResponse {
        id: instance.id,
        instance_id: instance.instance_id,
        agent_id: instance.agent_id,
        status: instance.status,
        container_id: instance.container_id,
        process_pid: instance.process_pid,
        last_heartbeat: instance.last_heartbeat.map(|dt| dt.to_string()),
        exit_code: instance.exit_code,
        crash_reason: instance.crash_reason,
        started_at: instance.started_at.map(|dt| dt.to_string()),
        stopped_at: instance.stopped_at.map(|dt| dt.to_string()),
    }).collect();

    Ok(Json(response))
}

async fn start_docker_container(container_id: &str) -> Result<(), StatusCode> {
    let output = TokioCommand::new("docker")
        .arg("start")
        .arg(container_id)
        .output()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if output.status.success() {
        Ok(())
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn stop_docker_container(container_id: &str) -> Result<(), StatusCode> {
    let output = TokioCommand::new("docker")
        .arg("stop")
        .arg(container_id)
        .output()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if output.status.success() {
        Ok(())
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn stop_process(pid: i32) -> Result<(), StatusCode> {
    // On Windows, use taskkill
    let output = TokioCommand::new("taskkill")
        .arg("/PID")
        .arg(pid.to_string())
        .arg("/T")
        .arg("/F")
        .output()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if output.status.success() {
        Ok(())
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn restart_process(state: &AppState, instance: &agent_instances::Model) -> Result<(), StatusCode> {
    // Find the agent definition
    let agent = agents::Entity::find_by_id(instance.agent_id.clone())
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Redeploy as a process
    let _ = crate::handlers::agents::deploy::deploy_process_agent(state, &agent, &instance.instance_id, None).await?;
    
    Ok(())
}
