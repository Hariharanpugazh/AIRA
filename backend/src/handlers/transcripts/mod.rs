use axum::{extract::{State, Query, Path}, http::StatusCode, Json};
use sea_orm::{EntityTrait, QueryOrder, PaginatorTrait, ColumnTrait, QueryFilter, ActiveModelTrait, Set, QuerySelect};
use chrono::Utc;
use uuid::Uuid;

use crate::entity::{transcripts, prelude::*};
use crate::models::transcripts::{TranscriptResponse, ListTranscriptsQuery, TranscriptSearchQuery, TranscriptSearchResponse, CreateTranscriptRequest};
use crate::utils::jwt::Claims;
use crate::AppState;

/// List transcripts with optional filtering
pub async fn list_transcripts(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Query(query): Query<ListTranscriptsQuery>,
) -> Result<Json<Vec<TranscriptResponse>>, StatusCode> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(100);

    let mut db_query = Transcripts::find().order_by_asc(transcripts::Column::Timestamp);

    if let Some(session_id) = query.session_id {
        db_query = db_query.filter(transcripts::Column::SessionId.eq(session_id));
    }

    if let Some(room_name) = query.room_name {
        db_query = db_query.filter(transcripts::Column::RoomName.eq(room_name));
    }

    if let Some(project_id) = query.project_id {
        db_query = db_query.filter(transcripts::Column::ProjectId.eq(project_id));
    }

    let paginator = db_query.paginate(&state.db, limit);
    let transcripts_list = paginator.fetch_page(page - 1).await.map_err(|e| {
        eprintln!("Database error listing transcripts: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = transcripts_list.into_iter().map(|t| TranscriptResponse {
        id: t.id,
        session_id: t.session_id,
        room_name: t.room_name,
        participant_identity: t.participant_identity,
        text: t.text,
        timestamp: t.timestamp.to_string(),
        language: t.language,
        is_final: t.is_final,
        project_id: t.project_id,
    }).collect();

    Ok(Json(response))
}

/// Get transcripts for a specific room (by room SID)
pub async fn get_room_transcripts(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Path(room_sid): Path<String>,
    Query(query): Query<ListTranscriptsQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let limit = query.limit.unwrap_or(100);
    let offset = query.page.unwrap_or(1).saturating_sub(1) * limit;

    let transcripts_list = Transcripts::find()
        .filter(transcripts::Column::SessionId.eq(&room_sid))
        .order_by_asc(transcripts::Column::Timestamp)
        .limit(limit)
        .offset(offset)
        .all(&state.db)
        .await
        .map_err(|e| {
            eprintln!("Database error getting room transcripts: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let total = Transcripts::find()
        .filter(transcripts::Column::SessionId.eq(&room_sid))
        .count(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let results: Vec<TranscriptResponse> = transcripts_list.into_iter().map(|t| TranscriptResponse {
        id: t.id,
        session_id: t.session_id,
        room_name: t.room_name,
        participant_identity: t.participant_identity,
        text: t.text,
        timestamp: t.timestamp.to_string(),
        language: t.language,
        is_final: t.is_final,
        project_id: t.project_id,
    }).collect();

    Ok(Json(serde_json::json!({
        "transcripts": results,
        "total": total,
        "room_sid": room_sid
    })))
}

/// Search transcripts by text content
pub async fn search_transcripts(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Query(query): Query<TranscriptSearchQuery>,
) -> Result<Json<TranscriptSearchResponse>, StatusCode> {
    use sea_orm::sea_query::{Expr, SimpleExpr};
    
    if query.q.is_empty() {
        return Ok(Json(TranscriptSearchResponse {
            results: vec![],
            query: query.q,
        }));
    }

    let mut db_query = Transcripts::find()
        .filter(transcripts::Column::Text.contains(&query.q));

    // Optional filters
    if let Some(room_sid) = query.room_sid {
        db_query = db_query.filter(transcripts::Column::SessionId.eq(room_sid));
    }
    
    if let Some(speaker_type) = query.speaker_type {
        // Map speaker_type to participant_identity pattern if needed
        // This is a simplified implementation
        db_query = db_query.filter(transcripts::Column::ParticipantIdentity.eq(speaker_type));
    }

    let limit = query.limit.unwrap_or(50);
    
    let transcripts_list: Vec<transcripts::Model> = db_query
        .order_by_desc(transcripts::Column::Timestamp)
        .limit(limit)
        .all(&state.db)
        .await
        .map_err(|e| {
            eprintln!("Database error searching transcripts: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let results: Vec<TranscriptResponse> = transcripts_list.into_iter().map(|t| TranscriptResponse {
        id: t.id,
        session_id: t.session_id,
        room_name: t.room_name,
        participant_identity: t.participant_identity,
        text: t.text,
        timestamp: t.timestamp.to_string(),
        language: t.language,
        is_final: t.is_final,
        project_id: t.project_id,
    }).collect();

    Ok(Json(TranscriptSearchResponse {
        results,
        query: query.q,
    }))
}

/// Create a new transcript entry
pub async fn create_transcript(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Json(req): Json<CreateTranscriptRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Validate required fields
    if req.session_id.is_empty() || req.text.is_empty() || req.room_name.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let new_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let new_transcript = transcripts::ActiveModel {
        id: Set(new_id.clone()),
        session_id: Set(req.session_id),
        room_name: Set(req.room_name),
        participant_identity: Set(req.participant_identity),
        text: Set(req.text),
        timestamp: Set(now.naive_utc()),
        language: Set(req.language),
        is_final: Set(req.is_final.unwrap_or(true)),
        project_id: Set(req.project_id),
    };

    let _inserted = new_transcript.insert(&state.db).await.map_err(|e| {
        eprintln!("Database error creating transcript: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({
        "id": new_id,
        "created_at": now.to_rfc3339()
    })))
}
