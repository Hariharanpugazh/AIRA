use axum::{extract::{State, Path, Query, self as ax_extract}, http::StatusCode, Json};
use std::collections::HashMap;
use once_cell::sync::Lazy;
use tokio::sync::RwLock;
use chrono::Utc;
use uuid::Uuid;
use crate::models::sip::*;
use crate::utils::jwt::Claims;
use crate::AppState;

static CALL_LOGS: Lazy<RwLock<Vec<CallLogResponse>>> = Lazy::new(|| RwLock::new(Vec::new()));

fn map_sip_error_status(message: &str) -> StatusCode {
    let msg = message.to_ascii_lowercase();
    if msg.contains("already exists") {
        StatusCode::CONFLICT
    } else if msg.contains("invalid_argument") {
        StatusCode::BAD_REQUEST
    } else if msg.contains("not_found") {
        StatusCode::NOT_FOUND
    } else if msg.contains("permission_denied") || msg.contains("unauthenticated") {
        StatusCode::FORBIDDEN
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}

fn normalize_string_list(list: Vec<String>) -> Vec<String> {
    let mut normalized: Vec<String> = list
        .into_iter()
        .map(|v| v.trim().to_ascii_lowercase())
        .filter(|v| !v.is_empty())
        .collect();
    normalized.sort();
    normalized.dedup();
    normalized
}

fn map_inbound_trunk(t: livekit_protocol::SipInboundTrunkInfo) -> SipTrunkResponse {
    SipTrunkResponse {
        id: t.sip_trunk_id.clone(),
        sip_trunk_id: t.sip_trunk_id,
        name: Some(t.name),
        metadata: Some(t.metadata),
        inbound_addresses: t.allowed_addresses,
        inbound_numbers_regex: t.numbers,
        outbound_address: None,
        sip_server: None,
        username: None,
        created_at: None,
    }
}

fn map_outbound_trunk(t: livekit_protocol::SipOutboundTrunkInfo) -> SipTrunkResponse {
    SipTrunkResponse {
        id: t.sip_trunk_id.clone(),
        sip_trunk_id: t.sip_trunk_id,
        name: Some(t.name),
        metadata: Some(t.metadata),
        inbound_addresses: vec![],
        inbound_numbers_regex: t.numbers,
        outbound_address: Some(t.address.clone()),
        sip_server: Some(t.address),
        username: if t.auth_username.is_empty() {
            None
        } else {
            Some(t.auth_username)
        },
        created_at: None,
    }
}

fn rule_signature(rule: &livekit_protocol::sip_dispatch_rule::Rule) -> String {
    match rule {
        livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleDirect(direct) => format!(
            "direct|{}|{}",
            direct.room_name.trim().to_ascii_lowercase(),
            direct.pin.trim().to_ascii_lowercase()
        ),
        livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleIndividual(individual) => format!(
            "individual|{}|{}",
            individual.room_prefix.trim().to_ascii_lowercase(),
            individual.pin.trim().to_ascii_lowercase()
        ),
        livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleCallee(callee) => format!(
            "callee|{}|{}|{}",
            callee.room_prefix.trim().to_ascii_lowercase(),
            callee.pin.trim().to_ascii_lowercase(),
            callee.randomize
        ),
    }
}

fn map_dispatch_rule_info(r: livekit_protocol::SipDispatchRuleInfo) -> SipDispatchRuleResponse {
    let (rule_type, mapped_rule) = if let Some(rule) = r.rule {
        match rule.rule {
            Some(livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleDirect(direct)) => (
                Some("direct".to_string()),
                Some(SipDispatchRule {
                    dispatch_rule: Some(DispatchRuleType::Recursive(RecursiveRule {
                        room_name: direct.room_name,
                        pin: if direct.pin.is_empty() { None } else { Some(direct.pin) },
                    })),
                }),
            ),
            Some(livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleIndividual(individual)) => (
                Some("individual".to_string()),
                Some(SipDispatchRule {
                    dispatch_rule: Some(DispatchRuleType::Individual(IndividualRule {
                        room_name_prefix: individual.room_prefix,
                        pin: if individual.pin.is_empty() {
                            None
                        } else {
                            Some(individual.pin)
                        },
                    })),
                }),
            ),
            Some(livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleCallee(callee)) => (
                Some("callee".to_string()),
                Some(SipDispatchRule {
                    dispatch_rule: Some(DispatchRuleType::Callee(CalleeRule {
                        room_name_prefix: callee.room_prefix,
                        pin: if callee.pin.is_empty() { None } else { Some(callee.pin) },
                        randomize: Some(callee.randomize),
                    })),
                }),
            ),
            _ => (None, None),
        }
    } else {
        (None, None)
    };

    SipDispatchRuleResponse {
        id: r.sip_dispatch_rule_id.clone(),
        sip_dispatch_rule_id: r.sip_dispatch_rule_id,
        name: Some(r.name),
        metadata: Some(r.metadata),
        rule: mapped_rule,
        trunk_ids: r.trunk_ids.clone(),
        hide_phone_number: r.hide_phone_number,
        rule_type,
        agent_id: r.attributes.get("agent_id").cloned(),
        trunk_id: r.trunk_ids.first().cloned(),
    }
}

#[derive(serde::Deserialize)]
pub struct OutboundCallRequest {
    pub trunk_id: String,
    pub to_number: String,
    pub room_name: Option<String>,
    pub participant_identity: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct CallLogsQuery {
    pub limit: Option<usize>,
}

#[derive(serde::Serialize, Clone)]
pub struct CallLogResponse {
    pub id: String,
    pub call_id: String,
    pub from_number: String,
    pub to_number: String,
    pub direction: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_seconds: Option<i64>,
    pub status: String,
    pub trunk_id: Option<String>,
    pub room_name: Option<String>,
    pub participant_identity: Option<String>,
}

pub async fn list_sip_trunks(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<Vec<SipTrunkResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let inbound_trunks = state.lk_service.list_sip_trunk().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let outbound_trunks = state
        .lk_service
        .list_sip_outbound_trunk()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut response: Vec<SipTrunkResponse> =
        inbound_trunks.into_iter().map(map_inbound_trunk).collect();
    response.extend(outbound_trunks.into_iter().map(map_outbound_trunk));

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

    let inbound_numbers = req
        .inbound_numbers_regex
        .clone()
        .or(req.numbers.clone())
        .unwrap_or_default();
    let normalized_inbound_numbers = normalize_string_list(inbound_numbers.clone());

    let outbound_address = req.outbound_address.clone().or(req.sip_server.clone());
    if let Some(address) = outbound_address.filter(|a| !a.trim().is_empty()) {
        let existing_outbound = state
            .lk_service
            .list_sip_outbound_trunk()
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if let Some(existing) = existing_outbound.into_iter().find(|t| {
            t.address.eq_ignore_ascii_case(&address)
                && normalize_string_list(t.numbers.clone()) == normalized_inbound_numbers
        }) {
            return Ok(Json(map_outbound_trunk(existing)));
        }

        let out_opts = livekit_api::services::sip::CreateSIPOutboundTrunkOptions {
            transport: livekit_protocol::SipTransport::Auto,
            metadata: req.metadata.clone().unwrap_or_default(),
            auth_username: req.outbound_username.clone().or(req.username.clone()).unwrap_or_default(),
            auth_password: req.outbound_password.clone().or(req.password.clone()).unwrap_or_default(),
            ..Default::default()
        };

        let t = state
            .lk_service
            .sip_client
            .create_sip_outbound_trunk(
                req.name.clone().unwrap_or_else(|| "default-outbound-trunk".to_string()),
                address.clone(),
                inbound_numbers,
                out_opts,
            )
            .await
            .map_err(|e| {
                eprintln!("Failed to create outbound SIP trunk: {:?}", e);
                map_sip_error_status(&format!("{:?}", e))
            })?;

        let mut mapped = map_outbound_trunk(t);
        mapped.created_at = Some(chrono::Utc::now().to_rfc3339());
        return Ok(Json(mapped));
    }

    let existing_inbound = state
        .lk_service
        .list_sip_trunk()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Some(existing) = existing_inbound.into_iter().find(|t| {
        normalize_string_list(t.numbers.clone()) == normalized_inbound_numbers
    }) {
        return Ok(Json(map_inbound_trunk(existing)));
    }

    let lk_req = livekit_api::services::sip::CreateSIPInboundTrunkOptions {
        metadata: req.metadata.clone(),
        allowed_addresses: req.inbound_addresses.clone(),
        allowed_numbers: req.inbound_numbers_regex.clone().or(req.numbers.clone()),
        auth_username: req.inbound_username.clone().or(req.username.clone()),
        auth_password: req.inbound_password.clone().or(req.password.clone()),
        ..Default::default()
    };

    let t = state
        .lk_service
        .sip_client
        .create_sip_inbound_trunk(
            req.name.unwrap_or_else(|| "default-trunk".to_string()),
            inbound_numbers,
            lk_req,
        )
        .await
        .map_err(|e| {
            eprintln!("Failed to create inbound SIP trunk: {:?}", e);
            map_sip_error_status(&format!("{:?}", e))
        })?;

    let mut mapped = map_inbound_trunk(t);
    mapped.username = req.inbound_username.clone().or(req.username.clone());
    mapped.created_at = Some(chrono::Utc::now().to_rfc3339());
    Ok(Json(mapped))
}

pub async fn delete_sip_trunk(
    State(state): State<AppState>,
    axum::extract::Extension(claims): ax_extract::Extension<Claims>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    state
        .lk_service
        .delete_sip_trunk(&id)
        .await
        .map_err(|e| {
            eprintln!("Failed to delete SIP trunk {}: {:?}", id, e);
            map_sip_error_status(&format!("{:?}", e))
        })?;

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

    let response = rules.into_iter().map(map_dispatch_rule_info).collect();

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

    let rule_type = req
        .rule_type
        .clone()
        .unwrap_or_else(|| {
            if req.randomize.unwrap_or(false) {
                "callee".to_string()
            } else if req.room_prefix.is_some() {
                "individual".to_string()
            } else {
                "direct".to_string()
            }
        })
        .to_ascii_lowercase();

    let rule = if rule_type == "callee" {
        let room_prefix = req
            .room_prefix
            .clone()
            .unwrap_or_else(|| "callee-".to_string());
        livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleCallee(
            livekit_protocol::SipDispatchRuleCallee {
                room_prefix,
                pin: req.pin.clone().unwrap_or_default(),
                randomize: req.randomize.unwrap_or(true),
            },
        )
    } else if rule_type == "individual" || req.room_prefix.is_some() {
        let room_prefix = req
            .room_prefix
            .clone()
            .unwrap_or_else(|| "inbound-".to_string());
        livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleIndividual(
            livekit_protocol::SipDispatchRuleIndividual {
                room_prefix,
                pin: req.pin.clone().unwrap_or_default(),
            }
        )
    } else {
        let room_name = req
            .room_name
            .clone()
            .unwrap_or_else(|| "default-sip-room".to_string());
        livekit_protocol::sip_dispatch_rule::Rule::DispatchRuleDirect(
            livekit_protocol::SipDispatchRuleDirect {
                room_name,
                pin: req.pin.clone().unwrap_or_default(),
            }
        )
    };

    let mut attributes = HashMap::new();
    if let Some(agent_id) = req.agent_id.clone() {
        attributes.insert("agent_id".to_string(), agent_id);
    }

    let trunk_ids = req
        .trunk_ids
        .clone()
        .or_else(|| req.trunk_id.clone().map(|id| vec![id]))
        .unwrap_or_default();
    let normalized_trunk_ids = normalize_string_list(trunk_ids.clone());
    let normalized_inbound_numbers = normalize_string_list(req.inbound_numbers.clone().unwrap_or_default());
    let requested_signature = rule_signature(&rule);

    let existing_rules = state
        .lk_service
        .list_sip_dispatch_rule()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(existing) = existing_rules.into_iter().find(|existing| {
        let existing_signature = existing
            .rule
            .as_ref()
            .and_then(|r| r.rule.as_ref())
            .map(rule_signature);
        existing_signature.as_deref() == Some(requested_signature.as_str())
            && normalize_string_list(existing.trunk_ids.clone()) == normalized_trunk_ids
            && normalize_string_list(existing.inbound_numbers.clone()) == normalized_inbound_numbers
    }) {
        return Ok(Json(map_dispatch_rule_info(existing)));
    }

    let r = state.lk_service.sip_client.create_sip_dispatch_rule(
        rule.clone(),
        livekit_api::services::sip::CreateSIPDispatchRuleOptions {
            name: req.name.unwrap_or_default(),
            metadata: req.metadata.unwrap_or_default(),
            trunk_ids: trunk_ids.clone(),
            hide_phone_number: req.hide_phone_number.unwrap_or_default(),
            attributes,
            allowed_numbers: req.inbound_numbers.clone().unwrap_or_default(),
        }
    ).await
        .map_err(|e| {
            eprintln!("Failed to create SIP dispatch rule: {:?}", e);
            map_sip_error_status(&format!("{:?}", e))
        })?;
    Ok(Json(map_dispatch_rule_info(r)))
}

pub async fn delete_sip_dispatch_rule(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    state
        .lk_service
        .delete_sip_dispatch_rule(&id)
        .await
        .map_err(|e| {
            eprintln!("Failed to delete SIP dispatch rule {}: {:?}", id, e);
            map_sip_error_status(&format!("{:?}", e))
        })?;

    Ok(StatusCode::OK)
}

pub async fn create_outbound_call(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<OutboundCallRequest>,
) -> Result<Json<CallLogResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    if req.trunk_id.trim().is_empty() || req.to_number.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let room_name = req
        .room_name
        .clone()
        .unwrap_or_else(|| format!("sip-{}", Uuid::new_v4().simple()));
    let participant_identity = req
        .participant_identity
        .clone()
        .unwrap_or_else(|| format!("sip-caller-{}", Uuid::new_v4().simple()));

    let participant = state
        .lk_service
        .sip_client
        .create_sip_participant(
            req.trunk_id.clone(),
            req.to_number.clone(),
            room_name.clone(),
            livekit_api::services::sip::CreateSIPParticipantOptions {
                participant_identity: participant_identity.clone(),
                participant_name: Some(participant_identity.clone()),
                ..Default::default()
            },
            None,
        )
        .await
        .map_err(|e| {
            eprintln!("Failed to create SIP participant/outbound call: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let call_log = CallLogResponse {
        id: Uuid::new_v4().to_string(),
        call_id: participant.sip_call_id,
        from_number: String::new(),
        to_number: req.to_number,
        direction: "outbound".to_string(),
        started_at: Utc::now().to_rfc3339(),
        ended_at: None,
        duration_seconds: None,
        status: "ringing".to_string(),
        trunk_id: Some(req.trunk_id),
        room_name: Some(room_name),
        participant_identity: Some(participant_identity),
    };

    let mut logs = CALL_LOGS.write().await;
    logs.insert(0, call_log.clone());

    Ok(Json(call_log))
}

pub async fn list_call_logs(
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Query(query): Query<CallLogsQuery>,
) -> Result<Json<Vec<CallLogResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let limit = query.limit.unwrap_or(50);
    let logs = CALL_LOGS.read().await;
    let items = logs.iter().take(limit).cloned().collect::<Vec<_>>();

    Ok(Json(items))
}

pub async fn end_call(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Path(call_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut logs = CALL_LOGS.write().await;
    if let Some(item) = logs
        .iter_mut()
        .find(|c| c.call_id == call_id || c.id == call_id)
    {
        if let (Some(room_name), Some(identity)) = (item.room_name.clone(), item.participant_identity.clone()) {
            let _ = state
                .lk_service
                .room_client
                .remove_participant(&room_name, &identity)
                .await;
        }

        item.status = "ended".to_string();
        let ended_at = Utc::now();
        item.ended_at = Some(ended_at.to_rfc3339());
        if let Ok(started) = chrono::DateTime::parse_from_rfc3339(&item.started_at) {
            item.duration_seconds = Some((ended_at.timestamp() - started.timestamp()).max(0));
        }
        return Ok(StatusCode::OK);
    }

    Err(StatusCode::NOT_FOUND)
}
