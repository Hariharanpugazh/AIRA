use axum::{extract::{State, Path}, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, Set};

use crate::entity::{ingress as db_ingress};
use crate::models::ingress::*;
use crate::utils::jwt::Claims;
use crate::AppState;
use livekit_protocol::IngressInput;

pub async fn list_ingress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<IngressResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let items = state.lk_service.list_ingress(None)
        .await
        .map_err(|e| {
            eprintln!("Failed to list ingress: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let response = items
        .into_iter()
        .map(|i| {
            let input_type = i.input_type as i32;
            let ingress_type = match i.input_type() {
                IngressInput::RtmpInput => "rtmp",
                IngressInput::WhipInput => "whip",
                IngressInput::UrlInput => "url",
            }
            .to_string();

            IngressResponse {
                ingress_id: i.ingress_id,
                name: i.name,
                stream_key: i.stream_key,
                url: i.url,
                input_type,
                ingress_type,
                status: i
                    .state
                    .as_ref()
                    .map(|s| format!("{:?}", s.status()).to_lowercase())
                    .unwrap_or_else(|| "inactive".to_string()),
                room_name: i.room_name,
                participant_identity: i.participant_identity,
                participant_name: i.participant_name,
                reusable: i.reusable,
                state: i.state.map(|s| IngressStateResponse {
                    status: format!("{:?}", s.status()),
                    error: s.error,
                    room_id: s.room_id,
                    started_at: s.started_at,
                    ended_at: s.ended_at,
                    resource_id: s.resource_id,
                    tracks: s.tracks.into_iter().map(|t| t.sid).collect(),
                }),
            }
        })
        .collect();

    Ok(Json(response))
}

pub async fn create_ingress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<CreateIngressRequest>,
) -> Result<Json<IngressResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let normalized_type = req
        .ingress_type
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();

    let input_type_code = req.input_type.unwrap_or_else(|| match normalized_type.as_str() {
        "whip" => 1,
        "url" => 2,
        _ => 0,
    });

    let input_type = match input_type_code {
        0 => IngressInput::RtmpInput,
        1 => IngressInput::WhipInput,
        2 => IngressInput::UrlInput,
        _ => IngressInput::RtmpInput,
    };

    let room_name = req.room_name.clone().unwrap_or_else(|| req.name.clone());
    let participant_identity = req
        .participant_identity
        .clone()
        .unwrap_or_else(|| format!("ingress-{}", req.name.to_lowercase().replace(' ', "-")));
    let participant_name = req
        .participant_name
        .clone()
        .unwrap_or_else(|| req.name.clone());

    let ingress = state
        .lk_service
        .ingress_client
        .create_ingress(
            input_type,
            livekit_api::services::ingress::CreateIngressOptions {
                name: req.name.clone(),
                room_name: room_name.clone(),
                participant_identity: participant_identity.clone(),
                participant_name: participant_name.clone(),
                ..Default::default()
            },
        )
        .await
        .map_err(|e| {
            eprintln!("Failed to create ingress: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Store in DB
    let ingress_model = db_ingress::ActiveModel {
        name: Set(req.name.clone()),
        input_type: Set(input_type_code.to_string()),
        room_name: Set(Some(room_name.clone())),
        stream_key: Set(Some(ingress.stream_key.clone())),
        url: Set(Some(ingress.url.clone())),
        ..Default::default()
    };

    let _ = ingress_model.insert(&state.db).await;

    let ingress_type = match input_type {
        IngressInput::RtmpInput => "rtmp".to_string(),
        IngressInput::WhipInput => "whip".to_string(),
        IngressInput::UrlInput => "url".to_string(),
    };

    Ok(Json(IngressResponse {
        ingress_id: ingress.ingress_id,
        name: ingress.name,
        stream_key: ingress.stream_key,
        url: ingress.url,
        input_type: input_type_code,
        ingress_type,
        status: "endpoint_buffering".to_string(),
        room_name,
        participant_identity: participant_identity,
        participant_name: participant_name,
        reusable: ingress.reusable,
        state: None,
    }))
}

pub async fn create_url_ingress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<CreateUrlIngressRequest>,
) -> Result<Json<IngressResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let ingress = state.lk_service.create_url_ingress(
        &req.url,
        &req.name,
        &req.room_name,
        &req.participant_identity,
        &req.participant_name
    )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Store in DB
    let ingress_model = db_ingress::ActiveModel {
        name: Set(req.name.clone()),
        input_type: Set("url".to_string()),
        room_name: Set(Some(req.room_name.clone())),
        url: Set(Some(ingress.url.clone())),
        ..Default::default()
    };

    let _ = ingress_model.insert(&state.db).await;

    Ok(Json(IngressResponse {
        ingress_id: ingress.ingress_id,
        name: ingress.name,
        stream_key: ingress.stream_key,
        url: ingress.url,
        input_type: 2, // URL = 2
        ingress_type: "url".to_string(),
        status: "endpoint_buffering".to_string(),
        room_name: req.room_name,
        participant_identity: ingress.participant_identity,
        participant_name: ingress.participant_name,
        reusable: ingress.reusable,
        state: None,
    }))
}

pub async fn delete_ingress(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Path(ingress_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    state.lk_service.delete_ingress(&ingress_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}
