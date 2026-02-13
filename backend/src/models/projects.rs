use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Serialize)]
pub struct ProjectResponse {
    pub id: String,
    pub short_id: Option<String>,
    pub user_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct UpdateAIConfigRequest {
    // STT
    pub stt_mode: Option<String>,
    pub stt_provider: Option<String>,
    pub stt_model: Option<String>,
    // TTS
    pub tts_mode: Option<String>,
    pub tts_provider: Option<String>,
    pub tts_model: Option<String>,
    pub tts_voice: Option<String>,
    // LLM
    pub llm_mode: Option<String>,
    pub llm_provider: Option<String>,
    pub llm_model: Option<String>,
}

#[derive(Serialize)]
pub struct AIConfigResponse {
    pub project_id: String,
    pub stt_mode: Option<String>,
    pub stt_provider: Option<String>,
    pub stt_model: Option<String>,
    pub tts_mode: Option<String>,
    pub tts_provider: Option<String>,
    pub tts_model: Option<String>,
    pub tts_voice: Option<String>,
    pub llm_mode: Option<String>,
    pub llm_provider: Option<String>,
    pub llm_model: Option<String>,
}
