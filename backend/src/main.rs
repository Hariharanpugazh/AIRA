mod handlers;
mod routes;
mod utils;
mod models;
mod entity;
mod services;

use axum::Router;
use tokio::net::TcpListener;
use routes::{
    auth, livekit, ingress, egress, sip, config as config_routes, metrics, agents,
    projects, sessions, analytics, settings, templates, rules, regions, webhook,
    audit_logs, transcripts, websocket
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

async fn health_handler() -> &'static str {
    "healthy"
}

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub http_client: reqwest::Client,
    pub lk_service: Arc<LiveKitService>,
}

async fn run_migrations(_db: &DatabaseConnection) {
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set for PostgreSQL migrations");
    let pool = sqlx::PgPool::connect(&db_url).await.expect("Failed to connect to database");

    let migrations = vec![
        include_str!("../migrations/20260204092336_create_users_table.sql"),
        include_str!("../migrations/20260209100000_create_livekit_tables.sql"),
        include_str!("../migrations/20260209110000_create_agents_tables.sql"),
        include_str!("../migrations/20260210000000_create_comprehensive_schema.sql"),
        include_str!("../migrations/20260210000001_add_project_id_to_agents.sql"),
        include_str!("../migrations/20260210000002_create_audit_logs.sql"),
        include_str!("../migrations/20260210000003_create_transcripts.sql"),
        include_str!("../migrations/20260210000004_seed_roles.sql"),
        include_str!("../migrations/20260210000005_seed_admin_user.sql"),
        include_str!("../migrations/20260212000000_add_phone_to_users.sql"),
        include_str!("../migrations/20260212010000_add_userid_shortid_to_projects.sql"),
        include_str!("../migrations/20260213000000_create_webhook_and_error_tables.sql"),
    ];

    for migration in migrations {
        for statement in migration.split(';') {
            let trimmed = statement.trim();
            if trimmed.is_empty() { continue; }
            if let Err(e) = sqlx::query(trimmed).execute(&pool).await {
                println!("Migration error (may be OK): {}", e);
            }
        }
    }
    println!("Migrations completed");
}

use tower_http::trace::TraceLayer;
use axum::extract::Request as AxumRequest;

/// Get allowed origins from environment
fn get_allowed_origins() -> Vec<String> {
    env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .collect()
}

/// Check if origin is allowed
fn is_origin_allowed(origin: &str, allowed: &[String]) -> bool {
    let normalized_origin = origin.trim_end_matches('/');
    allowed
        .iter()
        .map(|value| value.trim_end_matches('/'))
        .any(|allowed_origin| normalized_origin.eq_ignore_ascii_case(allowed_origin))
}

async fn cors_middleware(req: AxumRequest, next: Next) -> Response {
    let allowed_origins = get_allowed_origins();
    
    let origin_header = req
        .headers()
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_owned());

    const ALLOWED_METHODS: &str = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
    const ALLOWED_HEADERS: &str = "content-type,authorization";

    // Determine if origin is allowed
    let cors_origin = origin_header.as_ref()
        .filter(|origin| is_origin_allowed(origin, &allowed_origins))
        .cloned()
        .or_else(|| Some("null".to_string()));

    if req.method() == Method::OPTIONS {
        let mut res = Response::builder()
            .status(204)
            .body(AxBody::empty())
            .unwrap();

        let headers = res.headers_mut();
        if let Some(origin) = cors_origin {
            if let Ok(val) = HeaderValue::from_str(&origin) {
                headers.insert("access-control-allow-origin", val);
            }
        }
        headers.insert("access-control-allow-methods", HeaderValue::from_static(ALLOWED_METHODS));
        headers.insert("access-control-allow-headers", HeaderValue::from_static(ALLOWED_HEADERS));
        headers.insert("access-control-allow-credentials", HeaderValue::from_static("true"));
        headers.insert("access-control-max-age", HeaderValue::from_static("86400"));

        return res;
    }

    let mut res = next.run(req).await;
    let headers = res.headers_mut();
    
    if let Some(origin) = cors_origin {
        if let Ok(val) = HeaderValue::from_str(&origin) {
            headers.insert("access-control-allow-origin", val);
        }
    }
    headers.insert("access-control-allow-methods", HeaderValue::from_static(ALLOWED_METHODS));
    headers.insert("access-control-allow-headers", HeaderValue::from_static(ALLOWED_HEADERS));
    headers.insert("access-control-allow-credentials", HeaderValue::from_static("true"));

    res
}

/// Security headers middleware
async fn security_headers_middleware(req: AxumRequest, next: Next) -> Response {
    let mut res = next.run(req).await;
    let headers = res.headers_mut();
    
    // Prevent MIME type sniffing
    headers.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    
    // Prevent clickjacking
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    
    // XSS Protection
    headers.insert("x-xss-protection", HeaderValue::from_static("1; mode=block"));
    
    // Content Security Policy
    headers.insert("content-security-policy", HeaderValue::from_static(
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:;"
    ));
    
    // Referrer Policy
    headers.insert("referrer-policy", HeaderValue::from_static("strict-origin-when-cross-origin"));
    
    // Permissions Policy
    headers.insert("permissions-policy", HeaderValue::from_static(
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
    ));
    
    res
}

/// Request size limit middleware
async fn request_size_limit(req: AxumRequest, next: Next) -> Response {
    // Default 10MB limit
    let max_size: usize = env::var("MAX_REQUEST_SIZE")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(10 * 1024 * 1024);
    
    let content_length = req
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<usize>().ok());
    
    if let Some(size) = content_length {
        if size > max_size {
            return Response::builder()
                .status(413)
                .body(AxBody::from(format!("Request too large. Max size: {} bytes", max_size)))
                .unwrap();
        }
    }
    
    next.run(req).await
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    eprintln!("Backend starting up - Version: TraceLayer Enabled");
    
    // Load environment variables
    dotenvy::dotenv().ok();
    if env::var("LIVEKIT_API_KEY").is_err() {
        let parent_env = std::path::Path::new("..").join(".env");
        if parent_env.exists() {
            dotenvy::from_path(parent_env).ok();
        }
    }

    // Validate critical environment variables
    env::var("JWT_SECRET").expect("JWT_SECRET must be set - do not use default secrets in production");
    env::var("LIVEKIT_API_KEY").expect("LIVEKIT_API_KEY must be set");
    env::var("LIVEKIT_API_SECRET").expect("LIVEKIT_API_SECRET must be set");
    env::var("LIVEKIT_URL").expect("LIVEKIT_URL must be set");

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set (PostgreSQL only)");
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

    let app = Router::new()
        .route("/health", axum::routing::get(health_handler))
        .route("/api/ws/events", axum::routing::get(websocket::websocket_handler).layer(axum::middleware::from_fn(crate::utils::jwt::jwt_middleware)))
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
        .merge(audit_logs::routes())
        .merge(transcripts::routes())
        .with_state(state)
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(request_size_limit))
        .layer(axum::middleware::from_fn(security_headers_middleware))
        .layer(axum::middleware::from_fn(cors_middleware));

    let listener = TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("Failed to bind to port 8000");

    println!("Server running on http://127.0.0.1:8000");
    println!("CORS allowed origins: {:?}", get_allowed_origins());

    axum::serve(listener, app).await.expect("Failed to serve application");
}
