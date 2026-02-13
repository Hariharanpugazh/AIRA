use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptResponse {
    pub id: String,
    pub session_id: String,
    pub room_name: String,
    pub participant_identity: Option<String>,
    pub text: String,
    pub timestamp: String,
    pub language: Option<String>,
    pub is_final: bool,
    pub project_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListTranscriptsQuery {
    pub session_id: Option<String>,
    pub room_name: Option<String>,
    pub project_id: Option<String>,
    pub page: Option<u64>,
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptSearchQuery {
    pub q: String,
    pub room_sid: Option<String>,
    pub speaker_type: Option<String>,
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptSearchResponse {
    pub results: Vec<TranscriptResponse>,
    pub query: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTranscriptRequest {
    pub session_id: String,
    pub room_name: String,
    pub participant_identity: Option<String>,
    pub text: String,
    pub language: Option<String>,
    pub is_final: Option<bool>,
    pub project_id: Option<String>,
}
