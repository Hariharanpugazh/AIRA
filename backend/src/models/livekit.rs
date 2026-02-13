use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct ApiKeyResponse {
    pub id: String,
    pub name: String,
    pub key: String,
    pub key_prefix: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret_key: Option<String>,
    pub created_at: String,
    pub is_active: bool,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ListRoomsResponse {
    pub rooms: Vec<RoomResponse>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
    #[serde(rename = "emptyTimeout")]
    pub empty_timeout: Option<u32>,
    #[serde(rename = "maxParticipants")]
    pub max_participants: Option<u32>,
    pub metadata: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct RoomResponse {
    pub name: String,
    pub sid: String,
    pub empty_timeout: u32,
    pub max_participants: u32,
    pub creation_time: i64,
    pub num_participants: u32,
    pub active_recording: bool,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct CodecInfo {
    pub mime: String,
}

#[derive(Serialize, Deserialize)]
pub struct ParticipantResponse {
    pub sid: String,
    pub identity: String,
    pub name: Option<String>,
    pub state: String,
    pub joined_at: u64,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct TrackInfo {
    pub sid: String,
    pub name: String,
    pub kind: String,
}

#[derive(Serialize, Deserialize)]
pub struct LiveKitStatsResponse {
    pub active_rooms: i32,
    pub total_participants: i32,
    pub status: String,
}
