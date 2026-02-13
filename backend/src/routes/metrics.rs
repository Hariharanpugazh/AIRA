use axum::{routing::get, Router, middleware};
use crate::handlers::metrics;
use crate::utils::jwt::jwt_middleware;

pub fn routes() -> Router<crate::AppState> {
    // Public health endpoint
    let public = Router::new()
        .route("/health", get(metrics::health_check))
        .route("/metrics", get(metrics::prometheus_metrics));
    
    // Protected detailed metrics
    let protected = Router::new()
        .route("/api/metrics/system", get(metrics::system_metrics))
        .layer(middleware::from_fn(jwt_middleware));
    
    public.merge(protected)
}
