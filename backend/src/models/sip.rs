use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateSipTrunkRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub metadata: Option<String>,
    #[serde(default)]
    pub inbound_addresses: Option<Vec<String>>,
    #[serde(default)]
    pub inbound_numbers_regex: Option<Vec<String>>,
    #[serde(default)]
    pub numbers: Option<Vec<String>>,
    #[serde(default)]
    pub inbound_username: Option<String>,
    #[serde(default)]
    pub inbound_password: Option<String>,
    #[serde(default)]
    pub outbound_address: Option<String>,
    #[serde(default)]
    pub sip_server: Option<String>,
    #[serde(default)]
    pub outbound_username: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub outbound_password: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SipTrunkResponse {
    pub id: String,
    pub sip_trunk_id: String,
    pub name: Option<String>,
    pub metadata: Option<String>,
    pub inbound_addresses: Vec<String>,
    pub inbound_numbers_regex: Vec<String>,
    pub outbound_address: Option<String>,
    pub sip_server: Option<String>,
    pub username: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ListSipTrunkResponse {
    pub items: Vec<SipTrunkResponse>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateSipDispatchRuleRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub metadata: Option<String>,
    #[serde(default)]
    pub rule: Option<SipDispatchRule>,
    #[serde(default)]
    pub trunk_ids: Option<Vec<String>>,
    #[serde(default)]
    pub hide_phone_number: Option<bool>,
    #[serde(default)]
    pub inbound_numbers: Option<Vec<String>>,
    #[serde(default)]
    pub room_preset: Option<String>,
    #[serde(default)]
    pub room_config: Option<serde_json::Value>,
    #[serde(default)]
    pub room_name: Option<String>,
    #[serde(default)]
    pub room_prefix: Option<String>,
    #[serde(default)]
    pub pin: Option<String>,
    #[serde(default)]
    pub rule_type: Option<String>,
    #[serde(default)]
    pub trunk_id: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SipDispatchRuleResponse {
    pub id: String,
    pub sip_dispatch_rule_id: String,
    pub name: Option<String>,
    pub metadata: Option<String>,
    pub rule: Option<SipDispatchRule>,
    pub trunk_ids: Vec<String>,
    pub hide_phone_number: bool,
    pub rule_type: Option<String>,
    pub agent_id: Option<String>,
    pub trunk_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SipDispatchRule {
    #[serde(rename = "dispatchRule")]
    pub dispatch_rule: Option<DispatchRuleType>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DispatchRuleType {
    Individual(IndividualRule),
    Recursive(RecursiveRule),
}

#[derive(Serialize, Deserialize)]
pub struct IndividualRule {
    pub room_name_prefix: String,
    pub pin: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct RecursiveRule {
    pub room_name: String,
    pub pin: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ListSipDispatchRuleResponse {
    pub items: Vec<SipDispatchRuleResponse>,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct CreateSipCallRequest {
    pub trunk_id: String,
    pub to_number: String,
    pub from_number: String,
    pub room_name: String,
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct SipCallResponse {
    pub call_id: String,
    pub trunk_id: String,
    pub to_number: String,
    pub from_number: String,
    pub room_name: String,
    pub status: String,
}
