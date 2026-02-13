use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{EntityTrait, QueryFilter, ColumnTrait, QueryOrder, PaginatorTrait};
use tokio::process::Command;
use rust_decimal;

use crate::entity::{agent_metrics, agent_instances};
use crate::models::agents::AgentMetricResponse;
use crate::utils::jwt::Claims;
use crate::AppState;

pub async fn get_agent_metrics(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(instance_id): axum::extract::Path<String>,
) -> Result<Json<Vec<AgentMetricResponse>>, StatusCode> {
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

    // Get stored metrics from database
    let paginator = agent_metrics::Entity::find()
        .filter(agent_metrics::Column::InstanceId.eq(instance.id))
        .order_by_desc(agent_metrics::Column::Timestamp)
        .paginate(&state.db, 100);

    let metrics = paginator.fetch_page(0).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response: Vec<AgentMetricResponse> = metrics.into_iter().map(|metric| AgentMetricResponse {
        id: metric.id.to_string(),
        agent_id: metric.agent_id.to_string(),
        instance_id: metric.instance_id.to_string(),
        metric_name: metric.metric_name,
        metric_value: metric.metric_value.map(|d| d.to_string().parse().unwrap_or(0.0)),
        unit: metric.unit,
        timestamp: metric.timestamp.to_string(),
    }).collect();

    Ok(Json(response))
}

pub async fn collect_agent_metrics(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(instance_id): axum::extract::Path<String>,
) -> Result<Json<Vec<AgentMetricResponse>>, StatusCode> {
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

    let mut metrics = Vec::new();

    // Collect metrics based on deployment type
    if let Some(container_id) = &instance.container_id {
        metrics.extend(collect_docker_metrics(&state, &instance, container_id).await?);
    } else if let Some(pid) = instance.process_pid {
        metrics.extend(collect_process_metrics(&state, &instance, pid).await?);
    }

    // Store metrics in database
    for metric in &metrics {
        let metric_model = agent_metrics::ActiveModel {
            id: sea_orm::ActiveValue::Set(uuid::Uuid::new_v4()),
            agent_id: sea_orm::ActiveValue::Set(instance.agent_id),
            instance_id: sea_orm::ActiveValue::Set(instance.id),
            metric_name: sea_orm::ActiveValue::Set(metric.metric_name.clone()),
            metric_value: sea_orm::ActiveValue::Set(metric.metric_value.map(|v| rust_decimal::Decimal::try_from(v).unwrap_or(rust_decimal::Decimal::ZERO))),
            unit: sea_orm::ActiveValue::Set(metric.unit.clone()),
            ..Default::default()
        };

        let _ = agent_metrics::Entity::insert(metric_model).exec(&state.db).await;
    }

    Ok(Json(metrics))
}

async fn collect_docker_metrics(
    _state: &AppState,
    instance: &agent_instances::Model,
    container_id: &str,
) -> Result<Vec<AgentMetricResponse>, StatusCode> {
    let mut metrics = Vec::new();

    // Get Docker stats
    let output = Command::new("docker")
        .arg("stats")
        .arg("--no-stream")
        .arg("--format")
        .arg("{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}")
        .arg(container_id)
        .output()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if output.status.success() {
        let stats = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = stats.trim().split(',').collect();

        if parts.len() >= 2 {
            // CPU usage
            if let Ok(cpu_str) = parts[0].trim_end_matches('%').parse::<f64>() {
                metrics.push(AgentMetricResponse {
                    id: uuid::Uuid::new_v4().to_string(),
                    agent_id: instance.agent_id.to_string(),
                    instance_id: instance.instance_id.clone(),
                    metric_name: "cpu_percent".to_string(),
                    metric_value: Some(cpu_str),
                    unit: Some("%".to_string()),
                    timestamp: chrono::Utc::now().to_string(),
                });
            }

            // Memory usage (parse "123MiB / 456MiB" format)
            let mem_parts: Vec<&str> = parts[1].split('/').collect();
            if mem_parts.len() >= 1 {
                if let Some(mem_value) = parse_memory_usage(mem_parts[0]) {
                    metrics.push(AgentMetricResponse {
                        id: uuid::Uuid::new_v4().to_string(),
                        agent_id: instance.agent_id.to_string(),
                        instance_id: instance.instance_id.clone(),
                        metric_name: "memory_usage_mb".to_string(),
                        metric_value: Some(mem_value),
                        unit: Some("MB".to_string()),
                        timestamp: chrono::Utc::now().to_string(),
                    });
                }
            }
        }
    }

    // Get container uptime
    let inspect_output = Command::new("docker")
        .arg("inspect")
        .arg("--format")
        .arg("{{.State.StartedAt}}")
        .arg(container_id)
        .output()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if inspect_output.status.success() {
        let started_at = String::from_utf8_lossy(&inspect_output.stdout).trim().to_string();
        if let Ok(started_time) = chrono::DateTime::parse_from_rfc3339(&started_at) {
            let uptime_seconds = (chrono::Utc::now() - started_time.with_timezone(&chrono::Utc)).num_seconds() as f64;
            metrics.push(AgentMetricResponse {
                id: uuid::Uuid::new_v4().to_string(),
                agent_id: instance.agent_id.to_string(),
                instance_id: instance.instance_id.clone(),
                metric_name: "uptime_seconds".to_string(),
                metric_value: Some(uptime_seconds),
                unit: Some("s".to_string()),
                timestamp: chrono::Utc::now().to_string(),
            });
        }
    }

    Ok(metrics)
}

async fn collect_process_metrics(
    _state: &AppState,
    instance: &agent_instances::Model,
    _pid: i32,
) -> Result<Vec<AgentMetricResponse>, StatusCode> {
    let mut metrics = Vec::new();

    // On Windows, use tasklist or similar
    // This is a simplified implementation
    metrics.push(AgentMetricResponse {
        id: uuid::Uuid::new_v4().to_string(),
        agent_id: instance.agent_id.to_string(),
        instance_id: instance.instance_id.clone(),
        metric_name: "process_running".to_string(),
        metric_value: Some(1.0),
        unit: Some("boolean".to_string()),
        timestamp: chrono::Utc::now().to_string(),
    });

    Ok(metrics)
}

fn parse_memory_usage(mem_str: &str) -> Option<f64> {
    let mem_str = mem_str.trim();
    if mem_str.ends_with("MiB") {
        mem_str.trim_end_matches("MiB").trim().parse::<f64>().ok()
    } else if mem_str.ends_with("GiB") {
        mem_str.trim_end_matches("GiB").trim().parse::<f64>().ok().map(|v| v * 1024.0)
    } else if mem_str.ends_with("KiB") {
        mem_str.trim_end_matches("KiB").trim().parse::<f64>().ok().map(|v| v / 1024.0)
    } else {
        None
    }
}

pub async fn get_project_agent_stats(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(project_id): axum::extract::Path<String>,
) -> Result<Json<crate::models::agents::AgentProjectStats>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get agents for this project
    let agents_list = crate::entity::agents::Entity::find()
        .filter(crate::entity::agents::Column::ProjectId.eq(project_id))
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let agent_ids: Vec<uuid::Uuid> = agents_list.iter().map(|a| a.id).collect();

    // Count active instances for these agents
    let active_sessions = agent_instances::Entity::find()
        .filter(agent_instances::Column::Status.eq("running"))
        .filter(agent_instances::Column::AgentId.is_in(agent_ids.clone()))
        .count(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? as i32;

    // Calculate total minutes from agent instances (NO QUOTA LIMIT)
    let instances = agent_instances::Entity::find()
        .filter(agent_instances::Column::AgentId.is_in(agent_ids))
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let total_minutes: i64 = instances.iter()
        .filter_map(|instance| {
            let start = instance.started_at?;
            let end = instance.stopped_at.unwrap_or(start);
            Some((end - start).num_minutes())
        })
        .sum();

    // NO QUOTA - Unlimited usage
    Ok(Json(crate::models::agents::AgentProjectStats {
        active_sessions,
        total_minutes: total_minutes as i32,
        quota_minutes: -1, // -1 indicates unlimited
    }))
}