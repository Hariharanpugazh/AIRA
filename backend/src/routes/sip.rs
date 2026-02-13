use axum::{routing::{get, delete}, Router, middleware};
use crate::handlers::sip;
use crate::utils::jwt::jwt_middleware;

pub fn routes() -> Router<crate::AppState> {
    Router::new()
        // SIP Trunks
        .route("/api/telephony/sip-trunks", get(sip::list_sip_trunks).post(sip::create_sip_trunk))
        .route("/api/telephony/sip-trunks/:id", delete(sip::delete_sip_trunk))
        
        // Dispatch Rules
        .route("/api/telephony/dispatch-rules", get(sip::list_sip_dispatch_rules).post(sip::create_sip_dispatch_rule))
        .route("/api/telephony/dispatch-rules/:id", delete(sip::delete_sip_dispatch_rule))

        // SIP calls
        .route("/api/telephony/call-logs", get(sip::list_call_logs))
        .route("/api/telephony/outbound-call", axum::routing::post(sip::create_outbound_call))
        .route("/api/telephony/calls/:call_id/end", axum::routing::post(sip::end_call))
        
        .layer(middleware::from_fn(jwt_middleware))
}
