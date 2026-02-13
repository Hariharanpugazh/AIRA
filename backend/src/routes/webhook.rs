use axum::{routing::{post, get}, Router, middleware};
use crate::handlers::webhook;
use crate::utils::jwt::jwt_middleware;

pub fn routes() -> Router<crate::AppState> {
    Router::new()
        // Public webhook receiver (no auth - uses signature verification)
        .route("/webhook", post(webhook::handle_webhook))
        // Protected webhook management routes
        .route("/api/webhooks/events", get(webhook::get_webhook_events))
        .route("/api/webhooks/events/:id/retry", post(webhook::retry_webhook_event))
        .route("/api/webhooks/events/:id/deliveries", get(webhook::get_event_deliveries))
        .layer(middleware::from_fn(jwt_middleware))
}
