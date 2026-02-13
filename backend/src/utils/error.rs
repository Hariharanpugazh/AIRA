use axum::http::StatusCode;
use anyhow::Error as AnyhowError;

pub fn map_livekit_error(err: AnyhowError) -> StatusCode {
    let err_string = err.to_string().to_lowercase();

    if err_string.contains("unauthorized") || err_string.contains("forbidden") || err_string.contains("invalid api key") {
        StatusCode::UNAUTHORIZED
    } else if err_string.contains("not found") || err_string.contains("does not exist") {
        StatusCode::NOT_FOUND
    } else if err_string.contains("connection") || err_string.contains("timeout") || err_string.contains("unreachable") {
        StatusCode::SERVICE_UNAVAILABLE
    } else if err_string.contains("bad request") || err_string.contains("invalid") {
        StatusCode::BAD_REQUEST
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}