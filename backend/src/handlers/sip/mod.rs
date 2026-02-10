use axum::{extract::{State, Path, self as ax_extract}, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use std::env;
use crate::models::sip::*;
use crate::utils::jwt::Claims;
use crate::AppState;

fn get_livekit_url() -> String {
    env::var("LIVEKIT_URL").unwrap_or_else(|_| "http://localhost:7880".to_string())
}

pub async fn list_sip_trunks(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<SipTrunkResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let trunks = state.lk_service.list_sip_trunk().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = trunks.into_iter().map(|t| SipTrunkResponse {
        sip_trunk_id: t.sip_trunk_id,
        name: Some(t.name),
        metadata: Some(t.metadata),
        inbound_addresses: t.allowed_addresses,
        inbound_numbers_regex: vec![], // Simplified to empty vec
        outbound_address: None,
    }).collect();

    Ok(Json(response))
}

pub async fn create_sip_trunk(
    State(state): State<AppState>,
    axum::extract::Extension(claims): ax_extract::Extension<Claims>,
    Json(req): Json<CreateSipTrunkRequest>,
) -> Result<Json<SipTrunkResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let lk_req = livekit_protocol::CreateSipTrunkRequest {
        name: req.name.unwrap_or_default(),
        metadata: req.metadata.unwrap_or_default(),
        inbound_addresses: req.inbound_addresses.unwrap_or_default(),
        inbound_numbers_regex: req.inbound_numbers_regex.unwrap_or_default(),
        inbound_username: req.inbound_username.unwrap_or_default(),
        inbound_password: req.inbound_password.unwrap_or_default(),
        outbound_address: req.outbound_address.unwrap_or_default(),
        outbound_username: req.outbound_username.unwrap_or_default(),
        outbound_password: req.outbound_password.unwrap_or_default(),
        inbound_numbers: vec![],
        outbound_number: "".to_string(),
    };

    let t = state.lk_service.create_sip_trunk(lk_req).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(SipTrunkResponse {
        sip_trunk_id: t.sip_trunk_id,
        name: Some(t.name),
        metadata: Some(t.metadata),
        inbound_addresses: t.allowed_addresses,
        inbound_numbers_regex: vec![],
        outbound_address: None,
    }))
}

pub async fn delete_sip_trunk(
    State(state): State<AppState>,
    axum::extract::Extension(claims): ax_extract::Extension<Claims>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    state.lk_service.delete_sip_trunk(&id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

pub async fn list_sip_dispatch_rules(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<SipDispatchRuleResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let rules = state.lk_service.list_sip_dispatch_rule().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = rules.into_iter().map(|r| SipDispatchRuleResponse {
        sip_dispatch_rule_id: r.sip_dispatch_rule_id,
        name: Some(r.name),
        metadata: Some(r.metadata),
        rule: None, // Simplified mapping
        trunk_ids: r.trunk_ids,
        hide_phone_number: r.hide_phone_number,
    }).collect();

    Ok(Json(response))
}

pub async fn create_sip_dispatch_rule(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<CreateSipDispatchRuleRequest>,
) -> Result<Json<SipDispatchRuleResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Create the dispatch rule based on the request type
    let dispatch_rule = if let Some(room_name) = &req.room_name {
        // Direct room assignment rule
        Some(livekit_protocol::sip_dispatch_rule_info::DispatchRule::Direct(
            livekit_protocol::SipDispatchRuleDirect {
                room_name: room_name.clone(),
                pin: req.pin.clone().unwrap_or_default(),
            }
        ))
    } else if let Some(room_prefix) = &req.room_prefix {
        // Room prefix rule
        Some(livekit_protocol::sip_dispatch_rule_info::DispatchRule::Individual(
            livekit_protocol::SipDispatchRuleIndividual {
                room_prefix: room_prefix.clone(),
                pin: req.pin.clone().unwrap_or_default(),
            }
        ))
    } else {
        // Default to direct rule with a generic room
        Some(livekit_protocol::sip_dispatch_rule_info::DispatchRule::Direct(
            livekit_protocol::SipDispatchRuleDirect {
                room_name: "default-sip-room".to_string(),
                pin: req.pin.clone().unwrap_or_default(),
            }
        ))
    };

    let lk_req = livekit_protocol::CreateSipDispatchRuleRequest {
        name: req.name.unwrap_or_default(),
        metadata: req.metadata.unwrap_or_default(),
        rule: dispatch_rule,
        trunk_ids: req.trunk_ids.unwrap_or_default(),
        hide_phone_number: req.hide_phone_number.unwrap_or_default(),
        attributes: Default::default(),
        dispatch_rule: None, // Using the rule field instead
        inbound_numbers: req.inbound_numbers.unwrap_or_default(),
        room_preset: req.room_preset.clone().unwrap_or_default(),
        room_config: req.room_config.clone().map(|config| serde_json::to_string(&config).unwrap_or_default()),
    };

    let r = state.lk_service.create_sip_dispatch_rule(lk_req).await
        .map_err(|e| {
            eprintln!("Failed to create SIP dispatch rule: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(SipDispatchRuleResponse {
        sip_dispatch_rule_id: r.sip_dispatch_rule_id,
        name: Some(r.name),
        metadata: Some(r.metadata),
        rule: Some(models::sip::SipDispatchRule {
            rule_type: if r.dispatch_rule.is_some() { "direct".to_string() } else { "individual".to_string() },
            room_name: None, // Would need to extract from the rule
            room_prefix: None, // Would need to extract from the rule
        }),
        trunk_ids: r.trunk_ids,
        hide_phone_number: r.hide_phone_number,
    }))
}

pub async fn delete_sip_dispatch_rule(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    state.lk_service.delete_sip_dispatch_rule(&id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}
