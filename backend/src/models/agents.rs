use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
pub struct CreateAgentRequest {
    #[serde(default, alias = "name")]
    pub display_name: Option<String>,
    #[serde(default)]
    pub image: Option<String>,
    pub entrypoint: Option<String>,
    #[serde(default, alias = "environment")]
    pub env_vars: HashMap<String, String>,
    #[serde(default)]
    pub livekit_permissions: AgentPermissions,
    #[serde(default)]
    pub default_room_behavior: Option<String>,
    #[serde(default)]
    pub auto_restart_policy: Option<String>,
    #[serde(default)]
    pub resource_limits: Option<ResourceLimits>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateAgentRequest {
    #[serde(default, alias = "name")]
    pub display_name: Option<String>,
    pub image: Option<String>,
    pub entrypoint: Option<String>,
    #[serde(default, alias = "environment")]
    pub env_vars: Option<HashMap<String, String>>,
    pub livekit_permissions: Option<AgentPermissions>,
    pub default_room_behavior: Option<String>,
    pub auto_restart_policy: Option<String>,
    pub resource_limits: Option<ResourceLimits>,
    #[serde(default, alias = "status")]
    pub status: Option<String>,
    pub is_enabled: Option<bool>,
}

#[derive(Serialize, Deserialize)]
pub struct AgentResponse {
    pub id: String,
    pub agent_id: String,
    pub display_name: String,
    pub image: String,
    pub entrypoint: Option<String>,
    pub env_vars: HashMap<String, String>,
    pub livekit_permissions: AgentPermissions,
    pub default_room_behavior: String,
    pub auto_restart_policy: String,
    pub resource_limits: ResourceLimits,
    pub is_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct AgentPermissions {
    pub room_join: bool,
    pub room_create: bool,
    pub room_admin: bool,
    pub room_record: bool,
    pub ingress: bool,
    pub egress: bool,
    pub sip: bool,
}

impl Default for AgentPermissions {
    fn default() -> Self {
        Self {
            room_join: true,
            room_create: true,
            room_admin: true,
            room_record: true,
            ingress: true,
            egress: true,
            sip: true,
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct ResourceLimits {
    pub cpu_cores: Option<f64>,
    pub memory_mb: Option<i32>,
    pub max_instances: Option<i32>,
}

#[derive(Serialize, Deserialize)]
pub struct DeployAgentRequest {
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub deployment_type: String, // "docker" or "process"
    pub room_name: Option<String>, // Optional room to join immediately
}

#[derive(Serialize, Deserialize)]
pub struct DeployAgentResponse {
    pub instance_id: String,
    pub status: String,
    pub container_id: Option<String>,
    pub process_pid: Option<i32>,
}

#[derive(Serialize, Deserialize)]
pub struct AgentInstanceResponse {
    pub id: String,
    pub instance_id: String,
    pub agent_id: String,
    pub status: String,
    pub container_id: Option<String>,
    pub process_pid: Option<i32>,
    pub last_heartbeat: Option<String>,
    pub exit_code: Option<i32>,
    pub crash_reason: Option<String>,
    pub started_at: Option<String>,
    pub stopped_at: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct AgentLogResponse {
    pub id: String,
    pub agent_id: String,
    pub instance_id: String,
    pub log_level: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize)]
pub struct AgentMetricResponse {
    pub id: String,
    pub agent_id: String,
    pub instance_id: String,
    pub metric_name: String,
    pub metric_value: Option<f64>,
    pub unit: Option<String>,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize)]
pub struct AgentRoomAssignment {
    pub agent_id: String,
    pub room_name: String,
    pub instance_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AgentStatusSummary {
    pub total_agents: i32,
    pub running_instances: i32,
    pub stopped_instances: i32,
    pub crashed_instances: i32,
    pub unhealthy_instances: i32,
}

#[derive(Serialize, Deserialize)]
pub struct AgentProjectStats {
    pub active_sessions: i32,
    pub total_minutes: i32,
    pub quota_minutes: i32,
}
