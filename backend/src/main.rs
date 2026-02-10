mod handlers;
mod routes;
mod utils;
mod models;
mod entity;
mod services;

use axum::Router;
use dotenvy::dotenv;
use tokio::net::TcpListener;
use routes::{
    auth, livekit, ingress, egress, sip, config as config_routes, metrics, agents,
    projects, sessions, analytics, settings, templates, rules, regions, webhook
};
use services::livekit_service::LiveKitService;
use axum::http::Method;
use axum::middleware::Next;
use axum::response::Response;
use axum::body::Body as AxBody;
use axum::http::HeaderValue;
use std::sync::Arc;
use std::env;
use sea_orm::{Database, DatabaseConnection};
use livekit_api::services::room::RoomClient;
use livekit_api::services::egress::EgressClient;
use livekit_api::services::ingress::IngressClient;
use livekit_api::services::sip::SIPClient;

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub http_client: reqwest::Client,
    pub lk_service: Arc<LiveKitService>,
}

async fn run_migrations(db: &DatabaseConnection) {
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://./livekit_admin.db?mode=rwc".to_string());
    let pool = sqlx::SqlitePool::connect(&db_url).await.expect("Failed to connect to database");

    let migrations = vec![
        include_str!("../migrations/20260204092336_create_users_table.sql"),
        include_str!("../migrations/20260209100000_create_livekit_tables.sql"),
        include_str!("../migrations/20260209110000_create_agents_tables.sql"),
        include_str!("../migrations/20260210000000_create_comprehensive_schema.sql"),
        include_str!("../migrations/20260210000001_add_project_id_to_agents.sql"),
    ];

    for migration in migrations {
        if let Err(e) = sqlx::query(migration).execute(&pool).await {
            println!("Migration error (may be OK): {}", e);
        }
    }
    println!("Migrations completed");
}

#[tokio::main]
async fn main() {
    // Load environment variables from parent directory (root .env file)
    dotenv().ok();
    // Also try to load from parent directory if current directory doesn't have .env
    if env::var("LIVEKIT_API_KEY").is_err() {
        let parent_env = std::path::Path::new("..").join(".env");
        if parent_env.exists() {
            dotenvy::from_path(parent_env).ok();
        }
    }

    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://./livekit_admin.db?mode=rwc".to_string());
    let db = Database::connect(&db_url)
        .await
        .expect("DB connection failed");

    // Run migrations
    run_migrations(&db).await;

    let http_client = reqwest::Client::new();
    let lk_service = match LiveKitService::new() {
        Ok(service) => Arc::new(service),
        Err(e) => {
            eprintln!("Critical: Failed to initialize LiveKit service: {}. Server cannot start without LiveKit connection.", e);
            std::process::exit(1);
        }
    };

    let state = AppState { db, http_client, lk_service };

    async fn cors_middleware(req: axum::http::Request<AxBody>, next: Next) -> Response {
        if req.method() == Method::OPTIONS {
            let mut res = Response::builder()
                .status(204)
                .body(AxBody::empty())
                .unwrap();

            let headers = res.headers_mut();
            headers.insert("access-control-allow-origin", HeaderValue::from_static("*"));
            headers.insert("access-control-allow-methods", HeaderValue::from_static("GET, POST, OPTIONS"));
            headers.insert("access-control-allow-headers", HeaderValue::from_static("content-type,authorization"));
            headers.insert("access-control-allow-credentials", HeaderValue::from_static("true"));

            return res;
        }

        let mut res = next.run(req).await;
        let headers = res.headers_mut();
        headers.insert("access-control-allow-origin", HeaderValue::from_static("*"));
        headers.insert("access-control-allow-methods", HeaderValue::from_static("GET, POST, OPTIONS"));
        headers.insert("access-control-allow-headers", HeaderValue::from_static("content-type,authorization"));
        headers.insert("access-control-allow-credentials", HeaderValue::from_static("true"));

        res
    }

    let app = Router::new()
        .route("/health", axum::routing::get(|| async { axum::Json(serde_json::json!({"status": "healthy"})) }))
        .merge(auth::routes())
        .merge(livekit::routes())
        .merge(ingress::routes())
        .merge(egress::routes())
        .merge(sip::routes())
        .merge(config_routes::routes())
        .merge(metrics::routes())
        .merge(agents::routes())
        .merge(projects::routes())
        .merge(sessions::routes())
        .merge(analytics::routes())
        .merge(settings::routes())
        .merge(templates::routes())
        .merge(rules::routes())
        .merge(regions::routes())
        .merge(webhook::routes())
        .with_state(state)
        .layer(axum::middleware::from_fn(cors_middleware));

    let listener = TcpListener::bind("127.0.0.1:8000")
        .await
        .expect("Failed to bind to port 8000");

    println!("Server running on http://127.0.0.1:8000");

    axum::serve(listener, app).await.expect("Failed to serve application");
}
