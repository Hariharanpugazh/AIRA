use axum::{routing::{post, get, delete}, Router, middleware};
use crate::handlers::agents::{deploy, lifecycle, logs, metrics, rooms};
use crate::utils::jwt::jwt_middleware;

pub fn routes() -> Router<crate::AppState> {
    Router::new()
        // Agent definition management
        .route("/api/projects/:project_id/agents", post(deploy::create_agent))
        .route("/api/projects/:project_id/agents", get(deploy::list_agents))
        .route("/api/projects/:project_id/agents/:agent_id", get(deploy::get_agent).put(deploy::update_agent).delete(deploy::delete_agent))

        // Agent deployment
        .route("/api/projects/:project_id/agents/:agent_id/deploy", post(deploy::deploy_agent))

        // Agent lifecycle management (Global for now, or could be scoped)
        .route("/api/agent-instances", get(lifecycle::list_agent_instances))
        .route("/api/agent-instances/:instance_id/start", post(lifecycle::start_agent))
        .route("/api/agent-instances/:instance_id/stop", post(lifecycle::stop_agent))
        .route("/api/agent-instances/:instance_id/restart", post(lifecycle::restart_agent))

        // Agent logs
        .route("/api/projects/:project_id/agents/:agent_id/logs", get(logs::get_project_agent_logs))
        .route("/api/agent-instances/:instance_id/logs", get(logs::get_agent_logs))
        .route("/api/agent-instances/:instance_id/logs/stream", get(logs::stream_agent_logs))

        // Agent metrics
        .route("/api/agent-instances/:instance_id/metrics", get(metrics::get_agent_metrics))
        .route("/api/agent-instances/:instance_id/metrics/collect", post(metrics::collect_agent_metrics))

        // Agent room management - ALL scoped by project for isolation
        .route("/api/projects/:project_id/agents/:agent_id/rooms", get(rooms::get_agent_room_assignments))
        .route("/api/projects/:project_id/agents/assign-room", post(rooms::assign_agent_to_room))
        .route("/api/projects/:project_id/agents/:agent_id/rooms/:room_name", delete(rooms::remove_agent_from_room))
        .route("/api/projects/:project_id/rooms/:room_name/agents", get(rooms::get_room_agents))
        
        // Agent stats scoped by project
        .route("/api/projects/:project_id/agents/stats", get(metrics::get_project_agent_stats))
        .layer(middleware::from_fn(jwt_middleware))
}
