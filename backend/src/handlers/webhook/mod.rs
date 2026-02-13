use axum::{extract::{State, Query, Path}, http::StatusCode, Json};
use serde_json::Value;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use base64::{Engine as _, engine::general_purpose};
use std::env;
use std::collections::HashSet;
use chrono::Utc;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::collections::HashMap;
use sea_orm::{ActiveModelTrait, Set, EntityTrait, QueryFilter, ColumnTrait, prelude::Expr, QueryOrder, PaginatorTrait, QuerySelect};

use crate::AppState;
use crate::utils::jwt::Claims;
use crate::entity::{sessions, analytics_snapshots, webhook_deliveries, webhook_events};

// Webhook event types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WebhookEvent {
    pub id: String,
    pub event_type: String,
    pub payload: Value,
    pub processed: bool,
    pub created_at: String,
    pub delivery_attempts: i32,
    pub last_error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebhookEventsResponse {
    pub events: Vec<WebhookEvent>,
    pub count: usize,
}

#[derive(Debug, Deserialize)]
pub struct WebhookEventsQuery {
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RetryWebhookResponse {
    pub ok: bool,
    pub deliveries_queued: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventDeliveriesResponse {
    pub event_id: String,
    pub deliveries: Vec<DeliveryAttempt>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeliveryAttempt {
    pub id: String,
    pub event_id: String,
    pub url: String,
    pub status_code: Option<i32>,
    pub response_body: Option<String>,
    pub error_message: Option<String>,
    pub attempted_at: String,
    pub success: bool,
}

/// Handle incoming webhooks from LiveKit
pub async fn handle_webhook(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<Value>,
) -> Result<StatusCode, StatusCode> {
    // Verify webhook signature
    let signature = headers.get("x-livekit-signature")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::BAD_REQUEST)?;

    let secret = env::var("LIVEKIT_API_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let body = serde_json::to_string(&payload).map_err(|_| StatusCode::BAD_REQUEST)?;
    
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    mac.update(body.as_bytes());
    let result = mac.finalize();
    let expected_signature = format!("sha256={}", general_purpose::STANDARD.encode(result.into_bytes()));
    
    if !constant_time_eq(signature, &expected_signature) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Store the webhook event in database
    let event_id = Uuid::new_v4().to_string();
    let event_type = payload.get("event").and_then(|e| e.as_str()).unwrap_or("unknown").to_string();
    
    let event_model = webhook_events::ActiveModel {
        id: Set(event_id.clone()),
        event_type: Set(event_type.clone()),
        payload: Set(body.clone()),
        processed: Set(false),
        delivery_attempts: Set(0),
        created_at: Set(Utc::now().naive_utc()),
        ..Default::default()
    };
    
    // Store in database
    if let Err(e) = webhook_events::Entity::insert(event_model).exec(&state.db).await {
        eprintln!("Failed to store webhook event: {}", e);
    }

    // Process webhook event
    match event_type.as_str() {
        "room_started" => {
            if let Some(room) = payload.get("room").and_then(|r| r.get("name")).and_then(|n| n.as_str()) {
                if let Some(sid) = payload.get("room").and_then(|r| r.get("sid")).and_then(|s| s.as_str()) {
                    let session = sessions::ActiveModel {
                        sid: Set(sid.to_string()),
                        room_name: Set(room.to_string()),
                        status: Set("active".to_string()),
                        start_time: Set(Utc::now().naive_utc()),
                        ..Default::default()
                    };
                    if let Err(_) = session.insert(&state.db).await {
                        let _ = sessions::Entity::update_many()
                            .col_expr(sessions::Column::Status, Expr::value("active"))
                            .col_expr(sessions::Column::StartTime, Expr::value(Utc::now().naive_utc()))
                            .filter(sessions::Column::RoomName.eq(room))
                            .exec(&state.db)
                            .await;
                    }
                }
            }
        },
        "room_finished" => {
            if let Some(room) = payload.get("room").and_then(|r| r.get("name")).and_then(|n| n.as_str()) {
                let _ = sessions::Entity::update_many()
                    .col_expr(sessions::Column::Status, Expr::value("finished"))
                    .col_expr(sessions::Column::EndTime, Expr::value(Some(Utc::now().naive_utc())))
                    .filter(sessions::Column::RoomName.eq(room))
                    .exec(&state.db)
                    .await;
            }
        },
        "participant_joined" => {
            let _ = update_global_participants(&state.db, 1).await;
        },
        "participant_left" => {
            let _ = update_global_participants(&state.db, -1).await;
        },
        _ => {}
    }

    // Mark event as processed
    let _ = webhook_events::Entity::update_many()
        .col_expr(webhook_events::Column::Processed, Expr::value(true))
        .col_expr(webhook_events::Column::DeliveryAttempts, Expr::value(1))
        .filter(webhook_events::Column::Id.eq(&event_id))
        .exec(&state.db)
        .await;

    Ok(StatusCode::OK)
}

async fn update_global_participants(db: &sea_orm::DatabaseConnection, delta: i32) -> Result<(), sea_orm::DbErr> {
    let latest_snapshot: Option<crate::entity::analytics_snapshots::Model> = analytics_snapshots::Entity::find()
        .order_by_desc(analytics_snapshots::Column::Timestamp)
        .one(db)
        .await?;

    let current_count = latest_snapshot.map(|s| s.total_participants).unwrap_or(0);
    let new_count = (current_count as i32 + delta).max(0) as i32;

    let active_sessions = sessions::Entity::find()
        .filter(sessions::Column::Status.eq("active"))
        .all(db)
        .await?;
    let active_rooms = active_sessions.iter()
        .map(|s| &s.room_name)
        .collect::<HashSet<_>>()
        .len() as i32;

    let snapshot = analytics_snapshots::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        timestamp: Set(Utc::now().naive_utc()),
        active_rooms: Set(active_rooms),
        total_participants: Set(new_count),
        ..Default::default()
    };
    snapshot.insert(db).await?;
    Ok(())
}

fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let a_bytes = a.as_bytes();
    let b_bytes = b.as_bytes();
    let mut result = 0;
    for i in 0..a_bytes.len() {
        result |= a_bytes[i] ^ b_bytes[i];
    }
    result == 0
}

/// List webhook events from database
pub async fn get_webhook_events(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Query(query): Query<WebhookEventsQuery>,
) -> Result<Json<WebhookEventsResponse>, StatusCode> {
    let limit = query.limit.unwrap_or(100) as u64;
    
    let events = webhook_events::Entity::find()
        .order_by_desc(webhook_events::Column::CreatedAt)
        .limit(limit)
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let webhook_events: Vec<WebhookEvent> = events
        .into_iter()
        .map(|e| WebhookEvent {
            id: e.id,
            event_type: e.event_type,
            payload: serde_json::from_str(&e.payload).unwrap_or(Value::Null),
            processed: e.processed,
            created_at: e.created_at.to_string(),
            delivery_attempts: e.delivery_attempts,
            last_error: e.last_error,
        })
        .collect();
    
    let count = webhook_events.len();

    Ok(Json(WebhookEventsResponse {
        count,
        events: webhook_events,
    }))
}

/// Retry a webhook event - re-deliver to configured webhooks
pub async fn retry_webhook_event(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Path(event_id): Path<String>,
) -> Result<Json<RetryWebhookResponse>, StatusCode> {
    // Get the event
    let event = webhook_events::Entity::find_by_id(&event_id)
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    // Get configured webhooks
    let webhooks = crate::entity::configs::Entity::find()
        .filter(crate::entity::configs::Column::ServiceName.eq("webhooks"))
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let mut deliveries_queued = 0;
    
    // Attempt delivery to each webhook
    for webhook in webhooks {
        if let Some(config_value) = webhook.config_value {
            if let Ok(config) = serde_json::from_str::<crate::models::settings::WebhookResponse>(&config_value) {
                // Create delivery record
                let delivery_id = Uuid::new_v4().to_string();
                let delivery = webhook_deliveries::ActiveModel {
                    id: Set(delivery_id.clone()),
                    event_id: Set(event_id.clone()),
                    webhook_id: Set(config.id.clone()),
                    url: Set(config.url.clone()),
                    status_code: Set(None),
                    response_body: Set(None),
                    error_message: Set(None),
                    attempted_at: Set(Utc::now().naive_utc()),
                    success: Set(false),
                    ..Default::default()
                };
                
                if let Err(e) = webhook_deliveries::Entity::insert(delivery).exec(&state.db).await {
                    eprintln!("Failed to create delivery record: {}", e);
                    continue;
                }
                
                // Attempt HTTP delivery
                let client = reqwest::Client::new();
                match client.post(&config.url)
                    .header("Content-Type", "application/json")
                    .json(&serde_json::json!({
                        "event_id": event_id,
                        "event_type": event.event_type,
                        "payload": serde_json::from_str::<Value>(&event.payload).unwrap_or(Value::Null),
                        "timestamp": Utc::now().to_rfc3339(),
                    }))
                    .timeout(std::time::Duration::from_secs(30))
                    .send()
                    .await 
                {
                    Ok(response) => {
                        let status_code = response.status().as_u16() as i32;
                        let response_body = response.text().await.ok();
                        let success = status_code >= 200 && status_code < 300;
                        
                        // Update delivery record
                        let _ = webhook_deliveries::Entity::update_many()
                            .col_expr(webhook_deliveries::Column::StatusCode, Expr::value(status_code))
                            .col_expr(webhook_deliveries::Column::ResponseBody, Expr::value(response_body))
                            .col_expr(webhook_deliveries::Column::Success, Expr::value(success))
                            .filter(webhook_deliveries::Column::Id.eq(&delivery_id))
                            .exec(&state.db)
                            .await;
                        
                        if success {
                            deliveries_queued += 1;
                        }
                    },
                    Err(e) => {
                        let error_msg = e.to_string();
                        let _ = webhook_deliveries::Entity::update_many()
                            .col_expr(webhook_deliveries::Column::ErrorMessage, Expr::value(error_msg))
                            .filter(webhook_deliveries::Column::Id.eq(&delivery_id))
                            .exec(&state.db)
                            .await;
                    }
                }
            }
        }
    }
    
    // Update event delivery count
    let _ = webhook_events::Entity::update_many()
        .col_expr(webhook_events::Column::DeliveryAttempts, Expr::value(event.delivery_attempts + deliveries_queued as i32))
        .filter(webhook_events::Column::Id.eq(&event_id))
        .exec(&state.db)
        .await;
    
    Ok(Json(RetryWebhookResponse {
        ok: true,
        deliveries_queued,
    }))
}

/// Get event deliveries from database
pub async fn get_event_deliveries(
    State(state): State<AppState>,
    axum::extract::Extension(_claims): axum::extract::Extension<Claims>,
    Path(event_id): Path<String>,
) -> Result<Json<EventDeliveriesResponse>, StatusCode> {
    // Verify event exists
    let _ = webhook_events::Entity::find_by_id(&event_id)
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    // Get deliveries
    let deliveries = webhook_deliveries::Entity::find()
        .filter(webhook_deliveries::Column::EventId.eq(&event_id))
        .order_by_desc(webhook_deliveries::Column::AttemptedAt)
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let response: Vec<DeliveryAttempt> = deliveries.into_iter().map(|d| DeliveryAttempt {
        id: d.id,
        event_id: d.event_id,
        url: d.url,
        status_code: d.status_code,
        response_body: d.response_body,
        error_message: d.error_message,
        attempted_at: d.attempted_at.to_string(),
        success: d.success,
    }).collect();
    
    Ok(Json(EventDeliveriesResponse {
        event_id,
        deliveries: response,
    }))
}
