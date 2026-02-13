use axum::{extract::{State, Query, Path}, http::StatusCode, Json};
use sea_orm::{EntityTrait, ColumnTrait, QueryFilter, PaginatorTrait, ActiveModelTrait, Set, QueryOrder, QuerySelect};
use reqwest;
use serde_json;
use chrono::{Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::entity::{prelude::*, sessions, agents, error_logs};
use crate::models::metrics::{MetricResponse, MetricsSummary};
use crate::utils::jwt::Claims;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemMetric {
    pub metric_name: String,
    pub metric_value: f64,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorLog {
    pub id: String,
    pub error_type: String,
    pub message: String,
    pub is_resolved: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceStatusData {
    pub status: String,
    pub timestamp: String,
    pub services: HashMap<String, ServiceStatus>,
    pub latency_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub status: String,
    pub latency_ms: u64,
    pub details: Option<String>,
    pub error: Option<String>,
    pub rooms: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct MetricsQuery {
    pub hours: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct ErrorLogsQuery {
    pub unresolved_only: Option<bool>,
}

pub async fn get_metrics_summary(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<MetricsSummary>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get real-time data from LiveKit instead of Prometheus
    let rooms = state.lk_service.list_rooms().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let total_rooms = rooms.len() as i64;
    let total_participants = rooms.iter().map(|r| r.num_participants as i64).sum();
    
    // Get egress and ingress counts
    let egress_list = state.lk_service.list_egress(None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let active_egress = egress_list.len() as i64;
    
    let ingress_list = state.lk_service.list_ingress(None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let active_ingress = ingress_list.len() as i64;

    Ok(Json(MetricsSummary {
        total_rooms,
        total_participants,
        active_egress,
        active_ingress,
    }))
}

pub async fn get_recent_metrics(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<MetricResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let metrics = Metrics::find().all(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = metrics.into_iter().map(|m| MetricResponse {
        name: m.metric_name,
        value: m.metric_value.map(|v| v.to_string().parse().unwrap_or(0.0)),
        labels: m.labels,
        timestamp: m.timestamp.to_string(),
    }).collect();

    Ok(Json(response))
}

/// Get system metrics for the last N hours
pub async fn get_system_metrics(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Query(query): Query<MetricsQuery>,
) -> Result<Json<Vec<SystemMetric>>, StatusCode> {
    let hours = query.hours.unwrap_or(24);
    let since = Utc::now() - Duration::hours(hours as i64);
    
    let mut metrics = vec![];
    
    // Get active sessions count
    let active_sessions = Sessions::find()
        .filter(sessions::Column::Status.eq("active"))
        .count(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    metrics.push(SystemMetric {
        metric_name: "active_sessions".to_string(),
        metric_value: active_sessions as f64,
        timestamp: Utc::now().to_rfc3339(),
    });
    
    // Get total sessions in period
    let total_sessions = Sessions::find()
        .filter(sessions::Column::StartTime.gte(since))
        .count(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    metrics.push(SystemMetric {
        metric_name: "total_sessions".to_string(),
        metric_value: total_sessions as f64,
        timestamp: Utc::now().to_rfc3339(),
    });
    
    // Get enabled agents count
    let active_agents = <Agents as EntityTrait>::find()
        .filter(agents::Column::IsEnabled.eq(true))
        .count(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    metrics.push(SystemMetric {
        metric_name: "active_agents".to_string(),
        metric_value: active_agents as f64,
        timestamp: Utc::now().to_rfc3339(),
    });
    
    // Get error count
    let error_count = ErrorLogs::find()
        .filter(error_logs::Column::IsResolved.eq(false))
        .count(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    metrics.push(SystemMetric {
        metric_name: "unresolved_errors".to_string(),
        metric_value: error_count as f64,
        timestamp: Utc::now().to_rfc3339(),
    });
    
    Ok(Json(metrics))
}

/// Get error logs
pub async fn get_error_logs(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Query(query): Query<ErrorLogsQuery>,
) -> Result<Json<Vec<ErrorLog>>, StatusCode> {
    let mut db_query = ErrorLogs::find().order_by_desc(error_logs::Column::CreatedAt);
    
    if query.unresolved_only.unwrap_or(false) {
        db_query = db_query.filter(error_logs::Column::IsResolved.eq(false));
    }
    
    let logs = db_query.limit(100).all(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let response = logs.into_iter().map(|l| ErrorLog {
        id: l.id,
        error_type: l.error_type,
        message: l.message,
        is_resolved: l.is_resolved,
        created_at: l.created_at.map(|t| t.to_string()).unwrap_or_default(),
    }).collect();
    
    Ok(Json(response))
}

/// Resolve an error
pub async fn resolve_error(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Path(error_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let error = ErrorLogs::find_by_id(error_id)
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    let mut active_model: error_logs::ActiveModel = error.into();
    active_model.is_resolved = Set(true);
    active_model.updated_at = Set(Some(Utc::now().naive_utc()));
    
    active_model.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(StatusCode::OK)
}

/// Create error log (internal helper)
pub async fn create_error_log(
    state: &AppState,
    error_type: &str,
    message: &str,
) -> Result<(), StatusCode> {
    let new_log = error_logs::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        error_type: Set(error_type.to_string()),
        message: Set(message.to_string()),
        is_resolved: Set(false),
        created_at: Set(Some(Utc::now().naive_utc())),
        updated_at: Set(Some(Utc::now().naive_utc())),
        ..Default::default()
    };
    
    ErrorLogs::insert(new_log).exec(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(())
}

/// Get service status
pub async fn get_service_status(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<Json<ServiceStatusData>, StatusCode> {
    let start = std::time::Instant::now();
    let mut services = HashMap::new();
    
    // Check database connection
    let db_start = std::time::Instant::now();
    let db_status = match state.db.ping().await {
        Ok(_) => ServiceStatus {
            status: "healthy".to_string(),
            latency_ms: db_start.elapsed().as_millis() as u64,
            details: Some("PostgreSQL connected".to_string()),
            error: None,
            rooms: None,
        },
        Err(e) => ServiceStatus {
            status: "error".to_string(),
            latency_ms: db_start.elapsed().as_millis() as u64,
            details: None,
            error: Some(e.to_string()),
            rooms: None,
        },
    };
    services.insert("database".to_string(), db_status);
    
    // Check LiveKit connection
    let lk_start = std::time::Instant::now();
    let lk_status = match state.lk_service.check_health().await {
        Ok(true) => {
            // Get room count
            let rooms = match state.lk_service.list_rooms().await {
                Ok(r) => Some(r.len() as u32),
                Err(_) => None,
            };
            ServiceStatus {
                status: "healthy".to_string(),
                latency_ms: lk_start.elapsed().as_millis() as u64,
                details: Some("LiveKit server reachable".to_string()),
                error: None,
                rooms,
            }
        },
        Ok(false) => ServiceStatus {
            status: "unhealthy".to_string(),
            latency_ms: lk_start.elapsed().as_millis() as u64,
            details: Some("LiveKit health check failed".to_string()),
            error: None,
            rooms: None,
        },
        Err(e) => ServiceStatus {
            status: "error".to_string(),
            latency_ms: lk_start.elapsed().as_millis() as u64,
            details: None,
            error: Some(e.to_string()),
            rooms: None,
        },
    };
    services.insert("livekit".to_string(), lk_status);
    
    // Overall status
    let overall_status = if services.values().all(|s| s.status == "healthy") {
        "healthy"
    } else if services.values().any(|s| s.status == "error") {
        "degraded"
    } else {
        "healthy"
    }.to_string();
    
    Ok(Json(ServiceStatusData {
        status: overall_status,
        timestamp: Utc::now().to_rfc3339(),
        services,
        latency_ms: start.elapsed().as_millis() as u64,
    }))
}

/// Get Prometheus metrics (text format)
pub async fn get_prometheus_metrics(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<String, StatusCode> {
    let mut output = String::new();
    
    // Active sessions gauge
    let active_sessions = Sessions::find()
        .filter(sessions::Column::Status.eq("active"))
        .count(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    output.push_str("# HELP livekit_admin_active_sessions Number of active sessions\n");
    output.push_str("# TYPE livekit_admin_active_sessions gauge\n");
    output.push_str(&format!("livekit_admin_active_sessions {}\n", active_sessions));
    
    // Active agents gauge
    let active_agents = <Agents as EntityTrait>::find()
        .filter(agents::Column::IsEnabled.eq(true))
        .count(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    output.push_str("# HELP livekit_admin_active_agents Number of active agents\n");
    output.push_str("# TYPE livekit_admin_active_agents gauge\n");
    output.push_str(&format!("livekit_admin_active_agents {}\n", active_agents));
    
    // Total rooms from LiveKit
    match state.lk_service.list_rooms().await {
        Ok(rooms) => {
            output.push_str("# HELP livekit_rooms_total Total number of rooms\n");
            output.push_str("# TYPE livekit_rooms_total gauge\n");
            output.push_str(&format!("livekit_rooms_total {}\n", rooms.len()));
            
            // Total participants
            let total_participants: u32 = rooms.iter().map(|r| r.num_participants).sum();
            output.push_str("# HELP livekit_participants_total Total number of participants\n");
            output.push_str("# TYPE livekit_participants_total gauge\n");
            output.push_str(&format!("livekit_participants_total {}\n", total_participants));
        },
        Err(_) => {}
    }
    
    Ok(output)
}
