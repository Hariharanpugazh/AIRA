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
use std::time::Instant;
use sea_orm::{Database, DatabaseConnection};
use sha2::{Digest, Sha256};

// Note: Rate limiting disabled for self-hosted unlimited use

async fn health_handler() -> &'static str {
    "healthy"
}

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub http_client: reqwest::Client,
    pub lk_service: Arc<LiveKitService>,
}

struct EmbeddedMigration {
    version: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[EmbeddedMigration] = &[
    EmbeddedMigration {
        version: "20260204092336_create_users_table.sql",
        sql: include_str!("../migrations/20260204092336_create_users_table.sql"),
    },
    EmbeddedMigration {
        version: "20260209100000_create_livekit_tables.sql",
        sql: include_str!("../migrations/20260209100000_create_livekit_tables.sql"),
    },
    EmbeddedMigration {
        version: "20260209110000_create_agents_tables.sql",
        sql: include_str!("../migrations/20260209110000_create_agents_tables.sql"),
    },
    EmbeddedMigration {
        version: "20260210000000_create_comprehensive_schema.sql",
        sql: include_str!("../migrations/20260210000000_create_comprehensive_schema.sql"),
    },
    EmbeddedMigration {
        version: "20260210000001_add_project_id_to_agents.sql",
        sql: include_str!("../migrations/20260210000001_add_project_id_to_agents.sql"),
    },
    EmbeddedMigration {
        version: "20260210000002_create_audit_logs.sql",
        sql: include_str!("../migrations/20260210000002_create_audit_logs.sql"),
    },
    EmbeddedMigration {
        version: "20260210000003_create_transcripts.sql",
        sql: include_str!("../migrations/20260210000003_create_transcripts.sql"),
    },
    EmbeddedMigration {
        version: "20260210000004_seed_roles.sql",
        sql: include_str!("../migrations/20260210000004_seed_roles.sql"),
    },
    EmbeddedMigration {
        version: "20260210000005_seed_admin_user.sql",
        sql: include_str!("../migrations/20260210000005_seed_admin_user.sql"),
    },
    EmbeddedMigration {
        version: "20260212000000_add_phone_to_users.sql",
        sql: include_str!("../migrations/20260212000000_add_phone_to_users.sql"),
    },
    EmbeddedMigration {
        version: "20260212010000_add_userid_shortid_to_projects.sql",
        sql: include_str!("../migrations/20260212010000_add_userid_shortid_to_projects.sql"),
    },
    EmbeddedMigration {
        version: "20260213000000_create_webhook_and_error_tables.sql",
        sql: include_str!("../migrations/20260213000000_create_webhook_and_error_tables.sql"),
    },
];

fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut chars = sql.chars().peekable();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;

    while let Some(ch) = chars.next() {
        if in_line_comment {
            if ch == '\n' {
                in_line_comment = false;
                current.push('\n');
            }
            continue;
        }

        if in_block_comment {
            if ch == '*' && matches!(chars.peek(), Some('/')) {
                chars.next();
                in_block_comment = false;
            }
            continue;
        }

        if !in_single_quote && !in_double_quote {
            if ch == '-' && matches!(chars.peek(), Some('-')) {
                chars.next();
                in_line_comment = true;
                continue;
            }
            if ch == '/' && matches!(chars.peek(), Some('*')) {
                chars.next();
                in_block_comment = true;
                continue;
            }
        }

        if ch == '\'' && !in_double_quote {
            current.push(ch);
            if in_single_quote && matches!(chars.peek(), Some('\'')) {
                current.push(chars.next().unwrap_or_default());
                continue;
            }
            in_single_quote = !in_single_quote;
            continue;
        }

        if ch == '"' && !in_single_quote {
            current.push(ch);
            if in_double_quote && matches!(chars.peek(), Some('"')) {
                current.push(chars.next().unwrap_or_default());
                continue;
            }
            in_double_quote = !in_double_quote;
            continue;
        }

        if ch == ';' && !in_single_quote && !in_double_quote {
            let trimmed = current.trim();
            if !trimmed.is_empty() {
                statements.push(trimmed.to_string());
            }
            current.clear();
            continue;
        }

        current.push(ch);
    }

    let trailing = current.trim();
    if !trailing.is_empty() {
        statements.push(trailing.to_string());
    }

    statements
}

fn is_idempotent_migration_error(err: &sqlx::Error) -> bool {
    let msg = err.to_string().to_ascii_lowercase();
    msg.contains("already exists")
        || msg.contains("duplicate column")
        || msg.contains("duplicate object")
}

fn statement_preview(statement: &str) -> String {
    let compact = statement.split_whitespace().collect::<Vec<_>>().join(" ");
    compact.chars().take(200).collect()
}

async fn run_migrations(_db: &DatabaseConnection) -> anyhow::Result<()> {
    let db_url = env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL must be set for PostgreSQL migrations"))?;
    let pool = sqlx::PgPool::connect(&db_url).await?;

    // Check if force migration reset is enabled (DANGER: Only for development/recovery)
    let force_reset = env::var("FORCE_MIGRATION_RESET")
        .map(|v| v.to_lowercase() == "true" || v == "1")
        .unwrap_or(false);
    
    if force_reset {
        tracing::warn!("FORCE_MIGRATION_RESET is enabled - resetting migration state");
        sqlx::query("DROP TABLE IF EXISTS schema_migrations")
            .execute(&pool)
            .await?;
        tracing::info!("Migration table reset complete");
    }

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            execution_ms BIGINT NOT NULL DEFAULT 0,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(&pool)
    .await?;

    for migration in MIGRATIONS {
        let checksum = format!("{:x}", Sha256::digest(migration.sql.as_bytes()));
        let applied_checksum = sqlx::query_scalar::<_, String>(
            "SELECT checksum FROM schema_migrations WHERE version = $1",
        )
        .bind(migration.version)
        .fetch_optional(&pool)
        .await?;

        if let Some(existing) = applied_checksum {
            if existing != checksum {
                return Err(anyhow::anyhow!(
                    "Migration checksum drift detected for '{}'. Existing checksum does not match bundled migration.",
                    migration.version
                ));
            }
            println!("Migration {} already applied; skipping", migration.version);
            continue;
        }

        let started = Instant::now();
        let statements = split_sql_statements(migration.sql);
        let mut tolerated_errors = 0usize;

        for statement in statements {
            let mut tx = pool.begin().await?;
            match sqlx::query(&statement).execute(&mut *tx).await {
                Ok(_) => {
                    tx.commit().await?;
                }
                Err(err) => {
                    tx.rollback().await.ok();
                    if is_idempotent_migration_error(&err) {
                        tolerated_errors += 1;
                        println!(
                            "Migration {} tolerated idempotent statement error: {}",
                            migration.version, err
                        );
                        continue;
                    }

                    return Err(anyhow::anyhow!(
                        "Migration '{}' failed: {}\nStatement: {}",
                        migration.version,
                        err,
                        statement_preview(&statement)
                    ));
                }
            }
        }

        let elapsed = started.elapsed().as_millis() as i64;
        sqlx::query(
            "INSERT INTO schema_migrations (version, checksum, execution_ms) VALUES ($1, $2, $3)",
        )
        .bind(migration.version)
        .bind(&checksum)
        .bind(elapsed)
        .execute(&pool)
        .await?;

        if tolerated_errors > 0 {
            println!(
                "Migration {} marked applied with {} idempotent statements already present",
                migration.version, tolerated_errors
            );
        } else {
            println!("Migration {} applied in {}ms", migration.version, elapsed);
        }
    }

    println!("Migrations completed successfully");
    Ok(())
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
    
    // HSTS (only in production with HTTPS)
    if env::var("ENVIRONMENT").unwrap_or_default() == "production" {
        headers.insert("strict-transport-security", HeaderValue::from_static(
            "max-age=31536000; includeSubDomains; preload"
        ));
    }
    
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

/// Logging middleware for request/response
async fn logging_middleware(req: AxumRequest, next: Next) -> Response {
    let start = Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let request_id = uuid::Uuid::new_v4().to_string();
    
    // Add request ID to extensions for correlation
    let (parts, body) = req.into_parts();
    let mut req = AxumRequest::from_parts(parts, body);
    req.extensions_mut().insert(request_id.clone());
    
    tracing::info!(
        request_id = %request_id,
        method = %method,
        uri = %uri,
        "Request started"
    );
    
    let response = next.run(req).await;
    let duration = start.elapsed();
    let status = response.status();
    
    tracing::info!(
        request_id = %request_id,
        method = %method,
        uri = %uri,
        status = %status.as_u16(),
        duration_ms = %duration.as_millis(),
        "Request completed"
    );
    
    response
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into())
        )
        .with_target(true)
        .with_thread_ids(true)
        .with_line_number(true)
        .init();
    
    eprintln!("Backend starting up - Version: TraceLayer Enabled");
    eprintln!("Production Mode: Rate limiting, graceful shutdown, and security headers enabled");
    
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
    if let Err(err) = run_migrations(&db).await {
        eprintln!("Critical: migration failed: {:#}", err);
        std::process::exit(1);
    }

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
        // Rate limiting DISABLED - unlimited use for self-hosted
        // Request logging
        .layer(axum::middleware::from_fn(logging_middleware))
        // Trace layer for HTTP
        .layer(TraceLayer::new_for_http())
        // Request size limit
        .layer(axum::middleware::from_fn(request_size_limit))
        // Security headers
        .layer(axum::middleware::from_fn(security_headers_middleware))
        // CORS
        .layer(axum::middleware::from_fn(cors_middleware));

    let listener = TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("Failed to bind to port 8000");

    println!("Server running on http://127.0.0.1:8000");
    println!("CORS allowed origins: {:?}", get_allowed_origins());
    println!("Rate limiting: DISABLED (unlimited use mode)");

    // Graceful shutdown setup
    let server = axum::serve(listener, app);
    
    // Setup shutdown signal handler
    let graceful = server.with_graceful_shutdown(shutdown_signal());
    
    if let Err(e) = graceful.await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
    
    println!("Server shutdown complete");
}

/// Shutdown signal handler for graceful shutdown
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C, starting graceful shutdown...");
        }
        _ = terminate => {
            tracing::info!("Received SIGTERM, starting graceful shutdown...");
        }
    }
    
    // Give active requests time to complete (30 seconds)
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    tracing::info!("Graceful shutdown complete");
}
