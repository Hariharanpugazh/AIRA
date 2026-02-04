mod config;
mod handlers;
mod routes;
mod utils;
mod models;
mod entity;

use axum::Router;
use dotenvy::dotenv;
use tokio::net::TcpListener;
use config::database::connect_db;
use routes::auth_routes::auth_routes;
use axum::http::Method;
use axum::middleware::Next;
use axum::response::Response;
use axum::body::Body as AxBody;
use axum::http::HeaderValue;
#[tokio::main]
async fn main() {

    dotenv().ok();

    let db = connect_db().await;

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
        .merge(auth_routes(db))
        .layer(axum::middleware::from_fn(cors_middleware));

    let listener = TcpListener::bind("127.0.0.1:8000")
        .await
        .unwrap();

    println!("Server running on http://127.0.0.1:8000");

    axum::serve(listener, app).await.unwrap();
}
