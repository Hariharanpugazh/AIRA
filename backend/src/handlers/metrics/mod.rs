use axum::{extract::State, http::StatusCode, Json};
use serde_json::json;
use std::sync::Arc;
use std::collections::HashMap;
use chrono::Utc;

use crate::AppState;
use crate::utils::jwt::Claims;

/// System metrics response
#[derive(serde::Serialize)]
pub struct SystemMetrics {
    pub timestamp: String,
    pub uptime_seconds: u64,
    pub version: String,
    pub livekit: LiveKitMetrics,
    pub database: DatabaseMetrics,
    pub requests: RequestMetrics,
}

#[derive(serde::Serialize)]
pub struct LiveKitMetrics {
    pub connected: bool,
    pub active_rooms: i32,
    pub total_participants: i32,
}

#[derive(serde::Serialize)]
pub struct DatabaseMetrics {
    pub connected: bool,
    pub active_connections: Option<i32>,
}

#[derive(serde::Serialize)]
pub struct RequestMetrics {
    pub total_requests: u64,
    pub requests_per_second: f64,
    pub average_latency_ms: f64,
    pub error_rate: f64,
}

/// Prometheus-compatible metrics endpoint
pub async fn prometheus_metrics(
    State(state): State<AppState>,
) -> Result<String, StatusCode> {
    let mut output = String::new();
    
    // LiveKit metrics
    let lk_status = match state.lk_service.check_health().await {
        Ok(true) => 1,
        _ => 0,
    };
    
    output.push_str(&format!("# HELP livekit_connected LiveKit server connection status\n"));
    output.push_str(&format!("# TYPE livekit_connected gauge\n"));
    output.push_str(&format!("livekit_connected {}\n", lk_status));
    
    // Try to get room stats
    if let Ok(rooms) = state.lk_service.list_rooms().await {
        let active_rooms = rooms.len() as i32;
        let total_participants: i32 = rooms.iter().map(|r| r.num_participants as i32).sum();
        
        output.push_str(&format!("# HELP livekit_active_rooms Number of active rooms\n"));
        output.push_str(&format!("# TYPE livekit_active_rooms gauge\n"));
        output.push_str(&format!("livekit_active_rooms {}\n", active_rooms));
        
        output.push_str(&format!("# HELP livekit_total_participants Total participants across all rooms\n"));
        output.push_str(&format!("# TYPE livekit_total_participants gauge\n"));
        output.push_str(&format!("livekit_total_participants {}\n", total_participants));
    }
    
    // Database metrics
    let db_status = if state.db.ping().await.is_ok() { 1 } else { 0 };
    output.push_str(&format!("# HELP database_connected Database connection status\n"));
    output.push_str(&format!("# TYPE database_connected gauge\n"));
    output.push_str(&format!("database_connected {}\n", db_status));
    
    // Process metrics
    output.push_str(&format!("# HELP process_uptime_seconds Process uptime in seconds\n"));
    output.push_str(&format!("# TYPE process_uptime_seconds counter\n"));
    output.push_str(&format!("process_uptime_seconds {}\n", get_uptime_seconds()));
    
    Ok(output)
}

/// Health check endpoint with detailed status
pub async fn health_check(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use std::env;
    
    // Check LiveKit
    let livekit_status = match state.lk_service.check_health().await {
        Ok(true) => "healthy",
        _ => "unhealthy",
    };
    
    // Check Database
    let db_status = if state.db.ping().await.is_ok() { 
        "healthy" 
    } else { 
        "unhealthy" 
    };
    
    let overall_status = if livekit_status == "healthy" && db_status == "healthy" {
        "healthy"
    } else {
        "degraded"
    };
    
    // Check for dangerous settings
    let force_migration_reset = env::var("FORCE_MIGRATION_RESET")
        .map(|v| v.to_lowercase() == "true" || v == "1")
        .unwrap_or(false);
    
    let warnings: Vec<String> = if force_migration_reset {
        vec!["FORCE_MIGRATION_RESET is enabled - remove this after recovery!".to_string()]
    } else {
        vec![]
    };
    
    Ok(Json(json!({
        "status": overall_status,
        "timestamp": Utc::now().to_rfc3339(),
        "version": env!("CARGO_PKG_VERSION"),
        "services": {
            "livekit": livekit_status,
            "database": db_status,
        },
        "uptime_seconds": get_uptime_seconds(),
        "warnings": warnings,
    })))
}

/// Detailed system metrics
pub async fn system_metrics(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
) -> Result<Json<SystemMetrics>, StatusCode> {
    // Get LiveKit stats
    let (lk_connected, active_rooms, total_participants) = 
        match state.lk_service.list_rooms().await {
            Ok(rooms) => (true, rooms.len() as i32, rooms.iter().map(|r| r.num_participants as i32).sum()),
            Err(_) => (false, 0, 0),
        };
    
    // Get DB status
    let db_connected = state.db.ping().await.is_ok();
    
    Ok(Json(SystemMetrics {
        timestamp: Utc::now().to_rfc3339(),
        uptime_seconds: get_uptime_seconds(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        livekit: LiveKitMetrics {
            connected: lk_connected,
            active_rooms,
            total_participants,
        },
        database: DatabaseMetrics {
            connected: db_connected,
            active_connections: None, // Would need pg_stat_activity query
        },
        requests: RequestMetrics {
            total_requests: 0, // Would need request counter
            requests_per_second: 0.0,
            average_latency_ms: 0.0,
            error_rate: 0.0,
        },
    }))
}

/// Get process uptime
fn get_uptime_seconds() -> u64 {
    // This is a placeholder - in production, you'd track actual start time
    // For now, return 0 as we don't have persistent state
    0
}
