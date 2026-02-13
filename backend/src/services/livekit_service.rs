use livekit_api::services::room::RoomClient;
use livekit_api::services::egress::EgressClient;
use livekit_api::services::ingress::IngressClient;
use livekit_api::services::sip::SIPClient;
use livekit_protocol::{
    Room, ParticipantInfo, TrackInfo,
    IngressInfo, IngressInput,
    EgressInfo,
    SipTrunkInfo, SipInboundTrunkInfo, SipDispatchRuleInfo
};
use std::env;
use anyhow::Result;
use reqwest::Client;

pub struct LiveKitService {
    pub room_client: RoomClient,
    pub egress_client: EgressClient,
    pub ingress_client: IngressClient,
    pub sip_client: SIPClient,
    pub http_client: Client,
}

impl LiveKitService {
    pub fn new() -> Result<Self> {
        let host = env::var("LIVEKIT_URL").map_err(|_| anyhow::anyhow!("LIVEKIT_URL must be set"))?;
        let api_key = env::var("LIVEKIT_API_KEY").map_err(|_| anyhow::anyhow!("LIVEKIT_API_KEY must be set"))?;
        let api_secret = env::var("LIVEKIT_API_SECRET").map_err(|_| anyhow::anyhow!("LIVEKIT_API_SECRET must be set"))?;

        println!("Initializing LiveKit Service with Host: {}", host);
        println!("API Key provided: {}", if !api_key.is_empty() { "YES" } else { "NO" });

        Ok(Self {
            room_client: RoomClient::with_api_key(&host, &api_key, &api_secret),
            egress_client: EgressClient::with_api_key(&host, &api_key, &api_secret),
            ingress_client: IngressClient::with_api_key(&host, &api_key, &api_secret),
            sip_client: SIPClient::with_api_key(&host, &api_key, &api_secret),
            http_client: Client::new(),
        })
    }

    // Room Service
    pub async fn list_rooms(&self) -> Result<Vec<Room>> {
        let rooms = self.room_client.list_rooms(vec![]).await?;
        Ok(rooms)
    }

    pub async fn create_room(&self, name: &str, empty_timeout: u32, max_participants: u32) -> Result<Room> {
        let room = self.room_client.create_room(
            name,
            livekit_api::services::room::CreateRoomOptions {
                empty_timeout,
                max_participants,
                ..Default::default()
            }
        ).await?;
        Ok(room)
    }

    pub async fn delete_room(&self, room: &str) -> Result<()> {
        self.room_client.delete_room(room).await?;
        Ok(())
    }

    pub async fn list_participants(&self, room: &str) -> Result<Vec<ParticipantInfo>> {
        let participants = self.room_client.list_participants(room).await?;
        Ok(participants)
    }

    pub async fn remove_participant(&self, room: &str, identity: &str) -> Result<()> {
        self.room_client.remove_participant(room, identity).await?;
        Ok(())
    }

    pub async fn check_health(&self) -> Result<bool> {
        let host = env::var("LIVEKIT_URL").map_err(|_| anyhow::anyhow!("LIVEKIT_URL must be set"))?;
        let url = format!("{}/healthz", host);
        let response = self.http_client.get(&url).send().await?;
        Ok(response.status().is_success())
    }

    pub async fn mute_published_track(&self, room: &str, identity: &str, track_sid: &str, muted: bool) -> Result<TrackInfo> {
        let track = self.room_client.mute_published_track(room, identity, track_sid, muted).await?;
        Ok(track)
    }

    // Ingress Service
    pub async fn list_ingress(&self, room_name: Option<String>) -> Result<Vec<IngressInfo>> {
        let filter = match room_name {
            Some(name) => livekit_api::services::ingress::IngressListFilter::Room(name),
            None => livekit_api::services::ingress::IngressListFilter::All,
        };
        let items = self.ingress_client.list_ingress(filter).await?;
        Ok(items)
    }

    pub async fn create_ingress(&self, input_type: IngressInput, name: &str, room_name: &str) -> Result<IngressInfo> {
        let res = self.ingress_client.create_ingress(input_type, livekit_api::services::ingress::CreateIngressOptions {
            name: name.to_string(),
            room_name: room_name.to_string(),
            ..Default::default()
        }).await?;
        Ok(res)
    }

    pub async fn delete_ingress(&self, ingress_id: &str) -> Result<IngressInfo> {
        let res = self.ingress_client.delete_ingress(ingress_id).await?;
        Ok(res)
    }

    // Egress Service
    pub async fn list_egress(&self, room_name: Option<String>) -> Result<Vec<EgressInfo>> {
        let res = self.egress_client.list_egress(livekit_api::services::egress::EgressListOptions {
            filter: room_name.map(|name| livekit_api::services::egress::EgressListFilter::Room(name)).unwrap_or(livekit_api::services::egress::EgressListFilter::All),
            active: false,
        }).await?;
        Ok(res)
    }

    pub async fn start_room_composite_egress(&self, room: &str, outputs: Vec<livekit_api::services::egress::EgressOutput>, options: livekit_api::services::egress::RoomCompositeOptions) -> Result<EgressInfo> {
        let res = self.egress_client.start_room_composite_egress(room, outputs, options).await?;
        Ok(res)
    }

    pub async fn start_participant_egress(&self, room: &str, identity: &str, outputs: Vec<livekit_api::services::egress::EgressOutput>, options: livekit_api::services::egress::ParticipantEgressOptions) -> Result<EgressInfo> {
        let res = self.egress_client.start_participant_egress(room, identity, outputs, options).await?;
        Ok(res)
    }

    pub async fn start_web_egress(&self, url: &str, outputs: Vec<livekit_api::services::egress::EgressOutput>, options: livekit_api::services::egress::WebOptions) -> Result<EgressInfo> {
        let res = self.egress_client.start_web_egress(url, outputs, options).await?;
        Ok(res)
    }

    pub async fn start_track_egress(&self, room: &str, track_sid: &str, output: livekit_api::services::egress::EgressOutput) -> Result<EgressInfo> {
        let res = match output {
            livekit_api::services::egress::EgressOutput::File(_o) => {
                // The SDK variant expects Box<proto::DirectFileOutput>
                // EncodedFileOutput isn't directly convertible to DirectFileOutput easily, 
                // but usually TrackEgress is for DirectFileUpload or similar.
                // For now, if we can't align, we'll return an error if it's not what the SDK expects.
                return Err(anyhow::anyhow!("Track egress File output conversion issue - SDK expects DirectFileOutput"));
            },
            livekit_api::services::egress::EgressOutput::Stream(o) => {
                // WebSocket output for track expects a string URL
                let url = o.urls.first().cloned().unwrap_or_default();
                self.egress_client.start_track_egress(room, livekit_api::services::egress::TrackEgressOutput::WebSocket(url), track_sid).await?
            },
            _ => return Err(anyhow::anyhow!("Unsupported track egress output")),
        };
        Ok(res)
    }

    pub async fn start_track_composite_egress(&self, room: &str, outputs: Vec<livekit_api::services::egress::EgressOutput>, options: livekit_api::services::egress::TrackCompositeOptions) -> Result<EgressInfo> {
        let res = self.egress_client.start_track_composite_egress(room, outputs, options).await?;
        Ok(res)
    }

    pub async fn stop_egress(&self, egress_id: &str) -> Result<EgressInfo> {
        let res = self.egress_client.stop_egress(egress_id).await?;
        Ok(res)
    }

    // Specialized Ingress methods
    pub async fn create_url_ingress(&self, url: &str, name: &str, room_name: &str, identity: &str, participant_name: &str) -> Result<IngressInfo> {
        let res = self.ingress_client.create_ingress(IngressInput::UrlInput, livekit_api::services::ingress::CreateIngressOptions {
            name: name.to_string(),
            room_name: room_name.to_string(),
            url: url.to_string(),
            participant_identity: identity.to_string(),
            participant_name: participant_name.to_string(),
            ..Default::default()
        }).await?;
        Ok(res)
    }

    // SIP Service
    pub async fn list_sip_trunk(&self) -> Result<Vec<SipInboundTrunkInfo>> {
        // ListSIPInboundTrunkFilter::All is usually the way to go
        let res = self.sip_client.list_sip_inbound_trunk(livekit_api::services::sip::ListSIPInboundTrunkFilter::All).await?;
        Ok(res)
    }

    pub async fn create_sip_trunk(&self, req: livekit_protocol::CreateSipTrunkRequest) -> Result<SipInboundTrunkInfo> {
        let res = self.sip_client.create_sip_inbound_trunk(req.name, req.inbound_numbers, livekit_api::services::sip::CreateSIPInboundTrunkOptions {
            metadata: Some(req.metadata),
            allowed_addresses: Some(req.inbound_addresses),
            allowed_numbers: None, 
            ..Default::default()
        }).await?;
        Ok(res)
    }

    pub async fn delete_sip_trunk(&self, trunk_id: &str) -> Result<SipTrunkInfo> {
        let res = self.sip_client.delete_sip_trunk(trunk_id).await?;
        Ok(res)
    }

    pub async fn list_sip_dispatch_rule(&self) -> Result<Vec<livekit_protocol::SipDispatchRuleInfo>> {
        let res = self.sip_client.list_sip_dispatch_rule(livekit_api::services::sip::ListSIPDispatchRuleFilter::All).await?;
        Ok(res)
    }

    #[allow(deprecated)]
    pub async fn create_sip_dispatch_rule(&self, req: livekit_protocol::CreateSipDispatchRuleRequest) -> Result<SipDispatchRuleInfo> {
        let rule = req.rule.ok_or_else(|| anyhow::anyhow!("Rule is required"))?;
        let rule_enum = rule.rule.ok_or_else(|| anyhow::anyhow!("Inner rule is required"))?;
        let res = self.sip_client.create_sip_dispatch_rule(
            rule_enum,
            Default::default()
        ).await?;
        Ok(res)
    }

    pub async fn delete_sip_dispatch_rule(&self, rule_id: &str) -> Result<livekit_protocol::SipDispatchRuleInfo> {
        let res = self.sip_client.delete_sip_dispatch_rule(rule_id).await?;
        Ok(res)
    }
}
