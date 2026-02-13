use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateIngressRequest {
    pub name: String,
    #[serde(default)]
    pub room_name: Option<String>,
    #[serde(default)]
    pub participant_identity: Option<String>,
    #[serde(default)]
    pub participant_name: Option<String>,
    #[serde(default)]
    pub input_type: Option<i32>, // RTMP = 0, WHIP = 1, URL = 2
    #[serde(default)]
    pub ingress_type: Option<String>, // "rtmp" | "whip" | "url"
}

#[derive(Serialize, Deserialize)]
pub struct CreateUrlIngressRequest {
    pub name: String,
    pub url: String,
    pub room_name: String,
    pub participant_identity: String,
    pub participant_name: String,
    pub audio_enabled: bool,
    pub video_enabled: bool,
}

#[derive(Serialize, Deserialize)]
pub struct IngressResponse {
    pub ingress_id: String,
    pub name: String,
    pub input_type: i32,
    pub ingress_type: String,
    pub status: String,
    pub room_name: String,
    pub stream_key: String,
    pub url: String,
    pub participant_identity: String,
    pub participant_name: String,
    pub reusable: bool,
    pub state: Option<IngressStateResponse>,
}

#[derive(Serialize, Deserialize)]
pub struct IngressStateResponse {
    pub status: String,
    pub error: String,
    pub room_id: String,
    pub started_at: i64,
    pub ended_at: i64,
    pub resource_id: String,
    pub tracks: Vec<String>,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ListIngressResponse {
    pub items: Vec<IngressResponse>,
}
