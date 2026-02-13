use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryFilter, ColumnTrait};
use serde_json::json;
use std::env;
use std::process::Stdio;
use tokio::process::Command;
use uuid::Uuid;

use crate::entity::{agents, agent_instances, projects};
use crate::models::agents::{CreateAgentRequest, UpdateAgentRequest, AgentResponse, DeployAgentRequest, DeployAgentResponse};
use crate::utils::jwt::{Claims, create_agent_jwt};
use crate::AppState;

/// Verify user owns the project
async fn verify_project_access(
    state: &AppState,
    project_id: &str,
    user_id: &str,
) -> Result<bool, StatusCode> {
    let project = projects::Entity::find_by_id(project_id)
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(project.user_id == user_id)
}

pub async fn create_agent(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(project_id): axum::extract::Path<String>,
    Json(req): Json<CreateAgentRequest>,
) -> Result<Json<AgentResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    let agent_id = format!("agent_{}", Uuid::new_v4().simple());

    let agent_model = agents::ActiveModel {
        id: Set(Uuid::new_v4()),
        agent_id: Set(agent_id.clone()),
        display_name: Set(req.display_name),
        image: Set(req.image),
        entrypoint: Set(req.entrypoint),
        env_vars: Set(json!(req.env_vars)),
        livekit_permissions: Set(json!(req.livekit_permissions)),
        default_room_behavior: Set(req.default_room_behavior),
        auto_restart_policy: Set(req.auto_restart_policy),
        resource_limits: Set(json!(req.resource_limits)),
        is_enabled: Set(true),
        project_id: Set(Some(project_id)),
        ..Default::default()
    };

    let result = agent_model.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AgentResponse {
        id: result.id.to_string(),
        agent_id: result.agent_id,
        display_name: result.display_name,
        image: result.image,
        entrypoint: result.entrypoint,
        env_vars: serde_json::from_value(result.env_vars).unwrap_or_default(),
        livekit_permissions: serde_json::from_value(result.livekit_permissions).unwrap_or_default(),
        default_room_behavior: result.default_room_behavior,
        auto_restart_policy: result.auto_restart_policy,
        resource_limits: serde_json::from_value(result.resource_limits).unwrap_or_default(),
        is_enabled: result.is_enabled,
        created_at: result.created_at.to_string(),
        updated_at: result.updated_at.to_string(),
    }))
}

pub async fn update_agent(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((project_id, agent_id)): axum::extract::Path<(String, String)>,
    Json(req): Json<UpdateAgentRequest>,
) -> Result<Json<AgentResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(agent_id))
        .filter(agents::Column::ProjectId.eq(project_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let mut agent: agents::ActiveModel = agent.into();

    if let Some(display_name) = req.display_name {
        agent.display_name = Set(display_name);
    }
    if let Some(image) = req.image {
        agent.image = Set(image);
    }
    if let Some(entrypoint) = req.entrypoint {
        agent.entrypoint = Set(Some(entrypoint));
    }
    if let Some(env_vars) = req.env_vars {
        agent.env_vars = Set(json!(env_vars));
    }
    if let Some(permissions) = req.livekit_permissions {
        agent.livekit_permissions = Set(json!(permissions));
    }
    if let Some(behavior) = req.default_room_behavior {
        agent.default_room_behavior = Set(behavior);
    }
    if let Some(policy) = req.auto_restart_policy {
        agent.auto_restart_policy = Set(policy);
    }
    if let Some(limits) = req.resource_limits {
        agent.resource_limits = Set(json!(limits));
    }
    if let Some(enabled) = req.is_enabled {
        agent.is_enabled = Set(enabled);
    }

    let result = agent.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AgentResponse {
        id: result.id.to_string(),
        agent_id: result.agent_id,
        display_name: result.display_name,
        image: result.image,
        entrypoint: result.entrypoint,
        env_vars: serde_json::from_value(result.env_vars).unwrap_or_default(),
        livekit_permissions: serde_json::from_value(result.livekit_permissions).unwrap_or_default(),
        default_room_behavior: result.default_room_behavior,
        auto_restart_policy: result.auto_restart_policy,
        resource_limits: serde_json::from_value(result.resource_limits).unwrap_or_default(),
        is_enabled: result.is_enabled,
        created_at: result.created_at.to_string(),
        updated_at: result.updated_at.to_string(),
    }))
}

pub async fn list_agents(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path(project_id): axum::extract::Path<String>,
) -> Result<Json<Vec<AgentResponse>>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    let agents = agents::Entity::find()
        .filter(agents::Column::ProjectId.eq(project_id))
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response: Vec<AgentResponse> = agents.into_iter().map(|agent| AgentResponse {
        id: agent.id.to_string(),
        agent_id: agent.agent_id,
        display_name: agent.display_name,
        image: agent.image,
        entrypoint: agent.entrypoint,
        env_vars: serde_json::from_value(agent.env_vars).unwrap_or_default(),
        livekit_permissions: serde_json::from_value(agent.livekit_permissions).unwrap_or_default(),
        default_room_behavior: agent.default_room_behavior,
        auto_restart_policy: agent.auto_restart_policy,
        resource_limits: serde_json::from_value(agent.resource_limits).unwrap_or_default(),
        is_enabled: agent.is_enabled,
        created_at: agent.created_at.to_string(),
        updated_at: agent.updated_at.to_string(),
    }).collect();

    Ok(Json(response))
}

pub async fn deploy_agent(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((project_id, agent_id)): axum::extract::Path<(String, String)>,
    Json(req): Json<DeployAgentRequest>,
) -> Result<Json<DeployAgentResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    // Find the agent
    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(&agent_id))
        .filter(agents::Column::ProjectId.eq(project_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if !agent.is_enabled {
        return Err(StatusCode::BAD_REQUEST);
    }

    let instance_id = format!("inst_{}", Uuid::new_v4().simple());

    match req.deployment_type.as_str() {
        "docker" => deploy_docker_agent(&state, &agent, &instance_id, req.room_name).await,
        "process" => deploy_process_agent(&state, &agent, &instance_id, req.room_name).await,
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

async fn deploy_docker_agent(
    state: &AppState,
    agent: &agents::Model,
    instance_id: &str,
    room_name: Option<String>,
) -> Result<Json<DeployAgentResponse>, StatusCode> {
    // Generate LiveKit agent token
    let agent_token = generate_agent_token(agent).await?;

    // Prepare environment variables
    let mut env_vars = vec![
        format!("LIVEKIT_URL={}", env::var("LIVEKIT_URL").unwrap_or_else(|_| "ws://localhost:7880".to_string())),
        format!("LIVEKIT_API_KEY={}", env::var("LIVEKIT_API_KEY").unwrap_or_default()),
        format!("LIVEKIT_API_SECRET={}", env::var("LIVEKIT_API_SECRET").unwrap_or_default()),
        format!("LIVEKIT_AGENT_TOKEN={}", agent_token),
        format!("AGENT_INSTANCE_ID={}", instance_id),
    ];

    // Add custom env vars
    if let Ok(custom_env) = serde_json::from_value::<std::collections::HashMap<String, String>>(agent.env_vars.clone()) {
        for (key, value) in custom_env {
            env_vars.push(format!("{}={}", key, value));
        }
    }

    if let Some(room) = room_name {
        env_vars.push(format!("LIVEKIT_ROOM={}", room));
    }

    // Build Docker run command
    let mut cmd = Command::new("docker");
    cmd.arg("run")
        .arg("-d")
        .arg("--name")
        .arg(format!("livekit-agent-{}", instance_id))
        .arg("--network")
        .arg("livekit-core_livekit-network");

    // Add environment variables
    for env_var in env_vars {
        cmd.arg("-e").arg(env_var);
    }

    // Add resource limits if specified
    if let Ok(limits) = serde_json::from_value::<crate::models::agents::ResourceLimits>(agent.resource_limits.clone()) {
        if let Some(cpu) = limits.cpu_cores {
            cmd.arg("--cpus").arg(cpu.to_string());
        }
        if let Some(mem) = limits.memory_mb {
            cmd.arg("-m").arg(format!("{}m", mem));
        }
    }

    // Add image
    cmd.arg(&agent.image);

    // Add entrypoint if specified
    if let Some(entrypoint) = &agent.entrypoint {
        cmd.arg(entrypoint);
    }

    // Execute Docker command
    let output = cmd.output().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !output.status.success() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Create instance record
    let instance_model = agent_instances::ActiveModel {
        id: Set(Uuid::new_v4()),
        agent_id: Set(agent.id),
        instance_id: Set(instance_id.to_string()),
        container_id: Set(Some(container_id.clone())),
        status: Set("running".to_string()),
        started_at: Set(Some(chrono::Utc::now().into())),
        ..Default::default()
    };

    instance_model.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(DeployAgentResponse {
        instance_id: instance_id.to_string(),
        status: "running".to_string(),
        container_id: Some(container_id),
        process_pid: None,
    }))
}

pub async fn deploy_process_agent(
    state: &AppState,
    agent: &agents::Model,
    instance_id: &str,
    room_name: Option<String>,
) -> Result<Json<DeployAgentResponse>, StatusCode> {
    // Generate LiveKit agent token
    let agent_token = generate_agent_token(agent).await?;

    // Prepare environment variables
    let mut env_vars = std::collections::HashMap::new();
    env_vars.insert("LIVEKIT_URL".to_string(), env::var("LIVEKIT_URL").unwrap_or_else(|_| "ws://localhost:7880".to_string()));
    env_vars.insert("LIVEKIT_API_KEY".to_string(), env::var("LIVEKIT_API_KEY").unwrap_or_default());
    env_vars.insert("LIVEKIT_API_SECRET".to_string(), env::var("LIVEKIT_API_SECRET").unwrap_or_default());
    env_vars.insert("LIVEKIT_AGENT_TOKEN".to_string(), agent_token);
    env_vars.insert("AGENT_INSTANCE_ID".to_string(), instance_id.to_string());

    // Add custom env vars
    if let Ok(custom_env) = serde_json::from_value::<std::collections::HashMap<String, String>>(agent.env_vars.clone()) {
        env_vars.extend(custom_env);
    }

    if let Some(room) = room_name {
        env_vars.insert("LIVEKIT_ROOM".to_string(), room);
    }

    // Spawn the process
    let mut cmd = Command::new(&agent.image);
    cmd.envs(&env_vars)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(entrypoint) = &agent.entrypoint {
        cmd.arg(entrypoint);
    }

    let mut child = cmd.spawn()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let pid = child.id().ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    // Create instance record
    let instance_model = agent_instances::ActiveModel {
        id: Set(Uuid::new_v4()),
        agent_id: Set(agent.id),
        instance_id: Set(instance_id.to_string()),
        process_pid: Set(Some(pid as i32)),
        status: Set("running".to_string()),
        started_at: Set(Some(chrono::Utc::now().into())),
        ..Default::default()
    };

    let instance_db = instance_model.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Spawn a task to manage the process and log its output
    let db = state.db.clone();
    let instance_db_id = instance_db.id;
    let agent_id_clone = agent.id;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    tokio::spawn(async move {
        use tokio::io::AsyncBufReadExt;
        let mut stdout_reader = tokio::io::BufReader::new(stdout).lines();
        let mut stderr_reader = tokio::io::BufReader::new(stderr).lines();

        loop {
            tokio::select! {
                line = stdout_reader.next_line() => {
                    if let Ok(Some(line)) = line {
                        let _ = crate::handlers::agents::logs::store_agent_log_by_id(&db, agent_id_clone, instance_db_id, "INFO", &line).await;
                    } else { break; }
                }
                line = stderr_reader.next_line() => {
                    if let Ok(Some(line)) = line {
                        let _ = crate::handlers::agents::logs::store_agent_log_by_id(&db, agent_id_clone, instance_db_id, "ERROR", &line).await;
                    } else { break; }
                }
            }
        }
    });

    Ok(Json(DeployAgentResponse {
        instance_id: instance_id.to_string(),
        status: "running".to_string(),
        container_id: None,
        process_pid: Some(pid as i32),
    }))
}

async fn generate_agent_token(agent: &agents::Model) -> Result<String, StatusCode> {
    // Generate a JWT token for the agent with appropriate permissions
    let permissions = serde_json::from_value::<crate::models::agents::AgentPermissions>(agent.livekit_permissions.clone())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let video_grants = json!({
        "roomJoin": permissions.room_join,
        "roomCreate": permissions.room_create,
        "roomAdmin": permissions.room_admin,
        "roomRecord": permissions.room_record
    });

    let token = create_agent_jwt(
        agent.agent_id.clone(),
        agent.display_name.clone(),
        None, // room - will be set when joining specific room
        None, // metadata
        video_grants
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(token)
}

pub async fn get_agent(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((project_id, agent_id)): axum::extract::Path<(String, String)>,
) -> Result<Json<AgentResponse>, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(agent_id))
        .filter(agents::Column::ProjectId.eq(project_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(AgentResponse {
        id: agent.id.to_string(),
        agent_id: agent.agent_id,
        display_name: agent.display_name,
        image: agent.image,
        entrypoint: agent.entrypoint,
        env_vars: serde_json::from_value(agent.env_vars).unwrap_or_default(),
        livekit_permissions: serde_json::from_value(agent.livekit_permissions).unwrap_or_default(),
        default_room_behavior: agent.default_room_behavior,
        auto_restart_policy: agent.auto_restart_policy,
        resource_limits: serde_json::from_value(agent.resource_limits).unwrap_or_default(),
        is_enabled: agent.is_enabled,
        created_at: agent.created_at.to_string(),
        updated_at: agent.updated_at.to_string(),
    }))
}

pub async fn delete_agent(
    State(state): State<AppState>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    axum::extract::Path((project_id, agent_id)): axum::extract::Path<(String, String)>,
) -> Result<StatusCode, StatusCode> {
    if !claims.is_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    // Verify user owns this project
    if !verify_project_access(&state, &project_id, &claims.sub).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    let agent = agents::Entity::find()
        .filter(agents::Column::AgentId.eq(agent_id))
        .filter(agents::Column::ProjectId.eq(project_id))
        .one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let active_model: agents::ActiveModel = agent.into();
    active_model.delete(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}