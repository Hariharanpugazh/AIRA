use axum::{extract::State, http::StatusCode, Json};

use crate::models::livekit::{CreateRoomRequest, RoomResponse, ParticipantResponse};
use crate::utils::jwt::Claims;
use crate::utils::error::map_livekit_error;
use crate::AppState;

pub async fn create_room(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<RoomResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let room = state.lk_service.create_room(
        &req.name, 
        req.empty_timeout.unwrap_or(0), 
        req.max_participants.unwrap_or(0)
    )
        .await
        .map_err(map_livekit_error)?;

    Ok(Json(RoomResponse {
        sid: room.sid,
        name: room.name,
        empty_timeout: room.empty_timeout,
        max_participants: room.max_participants,
        creation_time: room.creation_time as i64,
        num_participants: room.num_participants,
        active_recording: room.active_recording,
    }))
}

pub async fn list_rooms(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<RoomResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let rooms = state.lk_service.list_rooms()
        .await
        .map_err(map_livekit_error)?;
    
    let response = rooms.into_iter().map(|room| RoomResponse {
        sid: room.sid,
        name: room.name,
        empty_timeout: room.empty_timeout,
        max_participants: room.max_participants,
        creation_time: room.creation_time as i64,
        num_participants: room.num_participants,
        active_recording: room.active_recording,
    }).collect();

    Ok(Json(response))
}

pub async fn delete_room(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(room_name): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    state.lk_service.delete_room(&room_name)
        .await
        .map_err(map_livekit_error)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_participants(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(room_name): axum::extract::Path<String>,
) -> Result<Json<Vec<ParticipantResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let participants = state.lk_service.list_participants(&room_name)
        .await
        .map_err(map_livekit_error)?;

    let response = participants.into_iter().map(|p| ParticipantResponse {
        sid: p.sid,
        identity: p.identity,
        state: p.state.to_string(), 
        joined_at: p.joined_at as u64,
        name: Some(p.name),
    }).collect();

    Ok(Json(response))
}

pub async fn remove_participant(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((room_name, identity)): axum::extract::Path<(String, String)>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    state.lk_service.remove_participant(&room_name, &identity)
        .await
        .map_err(map_livekit_error)?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_room_detail(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(room_name): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get room details from LiveKit
    let rooms = state.lk_service.list_rooms()
        .await
        .map_err(map_livekit_error)?;

    let room = rooms.into_iter()
        .find(|r| r.name == room_name)
        .ok_or(StatusCode::NOT_FOUND)?;

    // Get participants
    let participants = state.lk_service.list_participants(&room_name)
        .await
        .map_err(map_livekit_error)?;

    Ok(Json(serde_json::json!({
        "room": {
            "sid": room.sid,
            "name": room.name,
            "participants": room.num_participants,
            "active_recording": room.active_recording,
            "creation_time": room.creation_time,
            "enabled_codecs": room.enabled_codecs,
        },
        "participants": participants.iter().map(|p| serde_json::json!({
            "sid": p.sid,
            "identity": p.identity,
            "name": p.name,
            "state": p.state().as_str_name(),
            "joined_at": p.joined_at,
            "is_publisher": p.is_publisher,
            "tracks": p.tracks.iter().map(|t| serde_json::json!({
                "sid": t.sid.clone(),
                "source": t.source().as_str_name(),
                "mime_type": t.mime_type,
                "muted": t.muted,
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
        "participant_count": participants.len(),
    })))
}

pub async fn get_livekit_stats(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<crate::models::livekit::LiveKitStatsResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let rooms = state.lk_service.list_rooms()
        .await
        .map_err(map_livekit_error)?;

    let active_rooms = rooms.len() as i32;
    let total_participants = rooms.iter().map(|r| r.num_participants as i32).sum();

    Ok(Json(crate::models::livekit::LiveKitStatsResponse {
        active_rooms,
        total_participants,
        status: "healthy".to_string(),
    }))
}

#[derive(serde::Deserialize)]
pub struct MuteRequest {
    pub muted: bool,
    pub track_sid: Option<String>,
}

pub async fn mute_participant(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((room_name, identity)): axum::extract::Path<(String, String)>,
    Json(req): Json<MuteRequest>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // If track_sid is provided, mute that specific track
    // Otherwise, mute all published tracks for this participant
    if let Some(track_sid) = req.track_sid {
        state.lk_service.mute_published_track(&room_name, &identity, &track_sid, req.muted)
            .await
            .map_err(map_livekit_error)?;
    } else {
        // Get participant tracks and mute them all
        let participants = state.lk_service.list_participants(&room_name)
            .await
            .map_err(map_livekit_error)?;
        
        if let Some(participant) = participants.into_iter().find(|p| p.identity == identity) {
            for track in participant.tracks {
                state.lk_service.mute_published_track(&room_name, &identity, &track.sid, req.muted)
                    .await
                    .map_err(map_livekit_error)?;
            }
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(serde::Deserialize)]
pub struct UpdateParticipantRequest {
    pub name: Option<String>,
    pub metadata: Option<String>,
    pub permission: Option<serde_json::Value>,
}

pub async fn update_participant(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((room_name, identity)): axum::extract::Path<(String, String)>,
    Json(req): Json<UpdateParticipantRequest>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Update participant using LiveKit SDK
    // Build options based on what was provided
    let options = livekit_api::services::room::UpdateParticipantOptions {
        name: req.name.unwrap_or_default(),
        metadata: req.metadata.unwrap_or_default(),
        // Permission updates would require more complex mapping
        ..Default::default()
    };

    state.lk_service.room_client.update_participant(
        &room_name,
        &identity,
        options,
    ).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}
