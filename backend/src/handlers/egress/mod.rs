use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, Set};
use crate::entity::egress as db_egress;
use crate::models::egress::*;
use crate::utils::jwt::Claims;
use crate::AppState;

pub async fn list_egress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<EgressResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let egress_list = state.lk_service.list_egress(None).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = egress_list.into_iter().map(|e| EgressResponse {
        egress_id: e.egress_id,
        room_id: Some(e.room_id),
        room_name: e.room_name,
        status: e.status.to_string(),
        started_at: if e.started_at > 0 { Some(e.started_at) } else { None },
        ended_at: if e.ended_at > 0 { Some(e.ended_at) } else { None },
        error: if !e.error.is_empty() { Some(e.error) } else { None },
    }).collect();

    Ok(Json(response))
}

pub async fn start_room_composite(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<RoomCompositeEgressRequest>,
) -> Result<Json<EgressResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Map RoomCompositeEgressRequest to LiveKit types
    let mut outputs = vec![];
    
    // Add file output if specified
    if let Some(file) = &req.file {
        outputs.push(livekit_api::services::egress::EgressOutput::File(
            livekit_protocol::EncodedFileOutput {
                filepath: file.filepath.clone(),
                disable_manifest: file.disable_manifest.unwrap_or(false),
                encryption: file.encryption.clone().unwrap_or_default(),
                ..Default::default()
            }
        ));
    }
    
    // Add stream output if specified
    if let Some(stream) = &req.stream {
        outputs.push(livekit_api::services::egress::EgressOutput::Stream(
            livekit_protocol::StreamOutput {
                protocol: livekit_protocol::Protocol::default(), // Will default to RTMP
                urls: stream.urls.clone(),
                ..Default::default()
            }
        ));
    }
    
    // Add segments output if specified
    if let Some(segments) = &req.segments {
        outputs.push(livekit_api::services::egress::EgressOutput::Segments(
            livekit_protocol::SegmentOutput {
                filepath: segments.filepath.clone(),
                disable_manifest: segments.disable_manifest.unwrap_or(false),
                ..Default::default()
            }
        ));
    }

    let options = livekit_api::services::egress::RoomCompositeOptions {
        layout: req.layout.clone().unwrap_or_default(),
        audio_only: req.audio_only.unwrap_or(false),
        video_only: req.video_only.unwrap_or(false),
        encoding_options: None, // Can be set based on request
        ..Default::default()
    };

    let egress = state.lk_service.start_room_composite_egress(&req.room_name, outputs, options).await
        .map_err(|e| {
            eprintln!("Failed to start room composite egress: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Store in DB
    let egress_model = db_egress::ActiveModel {
        name: Set(req.room_name.clone()),
        egress_type: Set("room_composite".to_string()),
        room_name: Set(Some(req.room_name)),
        output_type: Set(if req.stream.is_some() { "stream".to_string() } else { "file".to_string() }),
        status: Set(egress.status.to_string()),
        ..Default::default()
    };

    let _ = egress_model.insert(&state.db).await.map_err(|e| {
        eprintln!("Failed to store egress in DB: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(EgressResponse {
        egress_id: egress.egress_id,
        room_id: Some(egress.room_id),
        room_name: egress.room_name,
        status: egress.status.to_string(),
        started_at: if egress.started_at > 0 { Some(egress.started_at) } else { None },
        ended_at: if egress.ended_at > 0 { Some(egress.ended_at) } else { None },
        error: if !egress.error.is_empty() { Some(egress.error) } else { None },
    }))
}

pub async fn start_participant_egress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<ParticipantEgressRequest>,
) -> Result<Json<EgressResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut outputs = vec![];
    
    // Add file output if specified
    if let Some(file) = &req.file {
        outputs.push(livekit_api::services::egress::EgressOutput::File(
            livekit_protocol::EncodedFileOutput {
                filepath: file.filepath.clone(),
                disable_manifest: file.disable_manifest.unwrap_or(false),
                encryption: file.encryption.clone().unwrap_or_default(),
                ..Default::default()
            }
        ));
    }
    
    // Add stream output if specified
    if let Some(stream) = &req.stream {
        outputs.push(livekit_api::services::egress::EgressOutput::Stream(
            livekit_protocol::StreamOutput {
                protocol: livekit_protocol::Protocol::default(), // Will default to RTMP
                urls: stream.urls.clone(),
                ..Default::default()
            }
        ));
    }
    
    // Add segments output if specified
    if let Some(segments) = &req.segments {
        outputs.push(livekit_api::services::egress::EgressOutput::Segments(
            livekit_protocol::SegmentOutput {
                filepath: segments.filepath.clone(),
                disable_manifest: segments.disable_manifest.unwrap_or(false),
                ..Default::default()
            }
        ));
    }

    let options = livekit_api::services::egress::ParticipantEgressOptions {
        audio_only: req.audio_only.unwrap_or(false),
        video_only: req.video_only.unwrap_or(false),
        file_outputs: vec![], // Can be set based on request
        stream_outputs: vec![], // Can be set based on request
        segment_outputs: vec![], // Can be set based on request
        encoding_options: None, // Can be set based on request
        ..Default::default()
    };

    let egress = state.lk_service.start_participant_egress(&req.room_name, &req.identity, outputs, options).await
        .map_err(|e| {
            eprintln!("Failed to start participant egress: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(EgressResponse {
        egress_id: egress.egress_id,
        room_id: Some(egress.room_id),
        room_name: egress.room_name,
        status: egress.status.to_string(),
        started_at: if egress.started_at > 0 { Some(egress.started_at) } else { None },
        ended_at: if egress.ended_at > 0 { Some(egress.ended_at) } else { None },
        error: if !egress.error.is_empty() { Some(egress.error) } else { None },
    }))
}

pub async fn stop_egress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(payload): Json<StopEgressRequest>,
) -> Result<Json<EgressResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let egress = state.lk_service.stop_egress(&payload.egress_id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(EgressResponse {
        egress_id: egress.egress_id,
        room_id: Some(egress.room_id),
        room_name: egress.room_name,
        status: egress.status.to_string(),
        started_at: if egress.started_at > 0 { Some(egress.started_at) } else { None },
        ended_at: if egress.ended_at > 0 { Some(egress.ended_at) } else { None },
        error: if !egress.error.is_empty() { Some(egress.error) } else { None },
    }))
}

pub async fn start_web_egress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<WebEgressRequest>,
) -> Result<Json<EgressResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut outputs = vec![];
    
    // Add file output if specified
    if let Some(file) = &req.file {
        outputs.push(livekit_api::services::egress::EgressOutput::File(
            livekit_protocol::EncodedFileOutput {
                filepath: file.filepath.clone(),
                disable_manifest: file.disable_manifest.unwrap_or(false),
                encryption: file.encryption.clone().unwrap_or_default(),
                ..Default::default()
            }
        ));
    }
    
    // Add stream output if specified
    if let Some(stream) = &req.stream {
        outputs.push(livekit_api::services::egress::EgressOutput::Stream(
            livekit_protocol::StreamOutput {
                protocol: livekit_protocol::Protocol::default(), // Will default to RTMP
                urls: stream.urls.clone(),
                ..Default::default()
            }
        ));
    }
    
    // Add segments output if specified
    if let Some(segments) = &req.segments {
        outputs.push(livekit_api::services::egress::EgressOutput::Segments(
            livekit_protocol::SegmentOutput {
                filepath: segments.filepath.clone(),
                disable_manifest: segments.disable_manifest.unwrap_or(false),
                ..Default::default()
            }
        ));
    }

    let options = livekit_api::services::egress::WebOptions {
        width: req.width.unwrap_or(1920),
        height: req.height.unwrap_or(1080),
        scale: req.scale.unwrap_or(1.0),
        video_only: req.video_only.unwrap_or(false),
        audio_only: req.audio_only.unwrap_or(false),
        ..Default::default()
    };

    let egress = state.lk_service.start_web_egress(&req.url, outputs, options).await
        .map_err(|e| {
            eprintln!("Failed to start web egress: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(EgressResponse {
        egress_id: egress.egress_id,
        room_id: Some(egress.room_id),
        room_name: egress.room_name, // For web egress, this might be empty
        status: egress.status.to_string(),
        started_at: if egress.started_at > 0 { Some(egress.started_at) } else { None },
        ended_at: if egress.ended_at > 0 { Some(egress.ended_at) } else { None },
        error: if !egress.error.is_empty() { Some(egress.error) } else { None },
    }))
}

pub async fn start_track_egress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<TrackEgressRequest>,
) -> Result<Json<EgressResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // For track egress, we need to use the correct output type
    // Track egress typically uses DirectFileOutput or WebSocket output
    let output = livekit_api::services::egress::TrackEgressOutput::DirectFile(
        livekit_protocol::DirectFileOutput {
            filepath: req.filepath.clone().unwrap_or_else(|| format!("{}.mp4", req.track_sid)),
            disable_manifest: req.disable_manifest.unwrap_or(true),
            ..Default::default()
        }
    );

    let egress = state.lk_service.egress_client.start_track_egress(
        &req.room_name,
        output,
        &req.track_sid
    ).await.map_err(|e| {
        eprintln!("Failed to start track egress: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(EgressResponse {
        egress_id: egress.egress_id,
        room_id: Some(egress.room_id),
        room_name: egress.room_name,
        status: egress.status.to_string(),
        started_at: if egress.started_at > 0 { Some(egress.started_at) } else { None },
        ended_at: if egress.ended_at > 0 { Some(egress.ended_at) } else { None },
        error: if !egress.error.is_empty() { Some(egress.error) } else { None },
    }))
}

pub async fn start_image_egress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<ImageEgressRequest>,
) -> Result<Json<EgressResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Image egress is typically done via track composite with image output
    let outputs = vec![livekit_api::services::egress::EgressOutput::Image(livekit_protocol::ImageOutput {
        filename_prefix: req.filename_prefix.clone().unwrap_or_else(|| format!("{}-snapshot", req.room_name)),
        capture_interval: req.capture_interval.unwrap_or(10),
        ..Default::default()
    })];
    
    let options = livekit_api::services::egress::TrackCompositeOptions {
        audio_only: req.audio_only.unwrap_or(false),
        video_only: req.video_only.unwrap_or(false),
        ..Default::default()
    };

    let egress = state.lk_service.start_track_composite_egress(&req.room_name, outputs, options).await
        .map_err(|e| {
            eprintln!("Failed to start image egress: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(EgressResponse {
        egress_id: egress.egress_id,
        room_id: Some(egress.room_id),
        room_name: egress.room_name,
        status: egress.status.to_string(),
        started_at: if egress.started_at > 0 { Some(egress.started_at) } else { None },
        ended_at: if egress.ended_at > 0 { Some(egress.ended_at) } else { None },
        error: if !egress.error.is_empty() { Some(egress.error) } else { None },
    }))
}

// compatibility stub for create_egress if needed by routes
pub async fn create_egress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<RoomCompositeEgressRequest>,
) -> Result<Json<EgressResponse>, StatusCode> {
    start_room_composite(State(state), axum::extract::Extension(claims), Json(req)).await
}