use axum::{routing::{post, get}, Router, middleware};
use crate::handlers::webhook;
use crate::utils::jwt::jwt_middleware;

pub fn routes() -> Router<crate::AppState> {
    let public_routes = Router::new()
        .route("/webhook", post(webhook::handle_webhook));

    let protected_routes = Router::new()
        .route("/api/webhooks/events", get(webhook::get_webhook_events))
        .route("/api/webhooks/events/:id/retry", post(webhook::retry_webhook_event))
        .route("/api/webhooks/events/:id/deliveries", get(webhook::get_event_deliveries))
        .layer(middleware::from_fn(jwt_middleware));

    public_routes.merge(protected_routes)
}
