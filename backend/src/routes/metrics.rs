use axum::{routing::{get, post}, Router, middleware};
use crate::handlers::metrics;
use crate::utils::jwt::jwt_middleware;

pub fn routes() -> Router<crate::AppState> {
    Router::new()
        // Legacy metrics routes
        .route("/api/metrics/summary", get(metrics::get_metrics_summary))
        .route("/api/metrics", get(metrics::get_recent_metrics))
        // New monitoring routes
        .route("/api/monitoring/metrics", get(metrics::get_system_metrics))
        .route("/api/monitoring/errors", get(metrics::get_error_logs))
        .route("/api/monitoring/errors/:id/resolve", post(metrics::resolve_error).get(metrics::resolve_error))
        .route("/api/monitoring/prometheus", get(metrics::get_prometheus_metrics))
        .route("/api/status", get(metrics::get_service_status))
        .layer(middleware::from_fn(jwt_middleware))
}
