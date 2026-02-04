use axum::{Router, routing::{post, get}};
use sea_orm::DatabaseConnection;

use crate::handlers::auth::{register, login, me};

pub fn auth_routes(db: DatabaseConnection) -> Router {

    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/api/auth/me", get(me))
        .with_state(db)
}
