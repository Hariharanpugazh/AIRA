use axum::{routing::{get, post}, Router, middleware};
#[allow(unused_imports)]
use crate::handlers::transcripts;
use crate::utils::jwt::jwt_middleware;

pub fn routes() -> Router<crate::AppState> {
    Router::new()
        .route("/api/transcripts", get(transcripts::list_transcripts).post(transcripts::create_transcript))
        .route("/api/transcripts/search", get(transcripts::search_transcripts))
        .route("/api/transcripts/:room_sid", get(transcripts::get_room_transcripts))
        .layer(middleware::from_fn(jwt_middleware))
}
