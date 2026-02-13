use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{EntityTrait, QueryFilter, ColumnTrait, QueryOrder, PaginatorTrait, QuerySelect};
use std::process::Stdio;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::entity::{agent_logs, agent_instances, agents, projects};
use crate::models::agents::AgentLogResponse;
use crate::utils::jwt::Claims;
use crate::AppState;

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

pub async fn get_agent_logs(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(instance_id): axum::extract::Path<String>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<AgentLogResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Find the instance
    let instance = agent_instances::Entity::find()
        .filter(agent_instances::Column::InstanceId.eq(&instance_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let limit = params.get("limit").and_then(|s| s.parse::<u64>().ok()).unwrap_or(100);
    let offset = params.get("offset").and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);

    // Get stored logs from database
    let paginator = agent_logs::Entity::find()
        .filter(agent_logs::Column::InstanceId.eq(instance.id))
        .order_by_desc(agent_logs::Column::Timestamp)
        .paginate(&state.db, limit);

    let logs = paginator.fetch_page(offset / limit).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response: Vec<AgentLogResponse> = logs.into_iter().map(|log| AgentLogResponse {
        id: log.id,
        agent_id: log.agent_id,
        instance_id: log.instance_id,
        log_level: log.log_level,
        message: log.message,
        timestamp: log.timestamp.map(|ts| ts.to_string()).unwrap_or_default(),
    }).collect();

    Ok(Json(response))
}

pub async fn stream_agent_logs(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(instance_id): axum::extract::Path<String>,
) -> Result<String, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Find the instance
    let instance = agent_instances::Entity::find()
        .filter(agent_instances::Column::InstanceId.eq(&instance_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Stream logs from Docker or process
    if let Some(container_id) = &instance.container_id {
        stream_docker_logs(container_id).await
    } else if let Some(_) = instance.process_pid {
        // For processes, we'll return the recent logs from DB since we're now storing them
        let logs = agent_logs::Entity::find()
            .filter(agent_logs::Column::InstanceId.eq(instance.id))
            .order_by_desc(agent_logs::Column::Timestamp)
            .limit(100)
            .all(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let formatted_logs: Vec<String> = logs.into_iter()
            .rev()
            .map(|l| format!(
                "[{}] [{}] {}",
                l.timestamp.map(|ts| ts.to_string()).unwrap_or_default(),
                l.log_level,
                l.message
            ))
            .collect();

        Ok(formatted_logs.join("\n"))
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn stream_docker_logs(container_id: &str) -> Result<String, StatusCode> {
    let mut cmd = Command::new("docker");
    cmd.arg("logs")
        .arg("-f")  // follow
        .arg("--tail")
        .arg("100")
        .arg(container_id)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let stdout = child.stdout.take().ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    let stderr = child.stderr.take().ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut logs = Vec::new();

    // Read a limited number of lines for the response
    for _ in 0..50 {
        tokio::select! {
            line = stdout_reader.next_line() => {
                if let Ok(Some(line)) = line {
                    logs.push(format!("[STDOUT] {}", line));
                } else {
                    break;
                }
            }
            line = stderr_reader.next_line() => {
                if let Ok(Some(line)) = line {
                    logs.push(format!("[STDERR] {}", line));
                } else {
                    break;
                }
            }
        }
    }

    // Kill the child process since we only want a snapshot
    let _ = child.kill().await;

    Ok(logs.join("\n"))
}

#[allow(dead_code)]
pub async fn store_agent_log(
    state: &AppState,
    instance_id: &str,
    level: &str,
    message: &str,
) -> Result<(), StatusCode> {
    // Find the instance
    let instance = agent_instances::Entity::find()
        .filter(agent_instances::Column::InstanceId.eq(instance_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    store_agent_log_by_id(&state.db, instance.agent_id, instance.id, level, message).await
}

pub async fn store_agent_log_by_id(
    db: &sea_orm::DatabaseConnection,
    agent_id: String,
    instance_db_id: String,
    level: &str,
    message: &str,
) -> Result<(), StatusCode> {
    let log_model = agent_logs::ActiveModel {
        id: sea_orm::ActiveValue::Set(uuid::Uuid::new_v4().to_string()),
        agent_id: sea_orm::ActiveValue::Set(agent_id),
        instance_id: sea_orm::ActiveValue::Set(instance_db_id),
        log_level: sea_orm::ActiveValue::Set(level.to_string()),
        message: sea_orm::ActiveValue::Set(message.to_string()),
        ..Default::default()
    };

    agent_logs::Entity::insert(log_model).exec(db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(())
}

pub async fn get_project_agent_logs(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((project_id, agent_id)): axum::extract::Path<(String, String)>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<AgentLogResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(&agent_id))
        .filter(agents::Column::ProjectId.eq(&project_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let limit = params.get("limit").and_then(|s| s.parse::<u64>().ok()).unwrap_or(100);
    let offset = params.get("offset").and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);

    let paginator = agent_logs::Entity::find()
        .filter(agent_logs::Column::AgentId.eq(agent.id))
        .order_by_desc(agent_logs::Column::Timestamp)
        .paginate(&state.db, limit);

    let logs = paginator
        .fetch_page(offset / limit)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response: Vec<AgentLogResponse> = logs
        .into_iter()
        .map(|log| AgentLogResponse {
            id: log.id,
            agent_id: log.agent_id,
            instance_id: log.instance_id,
            log_level: log.log_level,
            message: log.message,
            timestamp: log.timestamp.map(|ts| ts.to_string()).unwrap_or_default(),
        })
        .collect();

    Ok(Json(response))
}
