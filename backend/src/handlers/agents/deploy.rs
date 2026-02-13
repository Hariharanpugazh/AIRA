use axum::{extract::State, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, EntityTrait, Set, QueryFilter, ColumnTrait};
use serde::de::DeserializeOwned;
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

fn parse_json_or_default<T>(raw: &str) -> T
where
    T: DeserializeOwned + Default,
{
    if raw.trim().is_empty() {
        return T::default();
    }
    serde_json::from_str(raw).unwrap_or_default()
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
    let display_name = req
        .display_name
        .unwrap_or_else(|| "New Agent".to_string());
    let image = req
        .image
        .unwrap_or_else(|| "livekit/agent:latest".to_string());
    let default_room_behavior = req
        .default_room_behavior
        .unwrap_or_else(|| "auto".to_string());
    let auto_restart_policy = req
        .auto_restart_policy
        .unwrap_or_else(|| "always".to_string());
    let resource_limits = req.resource_limits.unwrap_or_default();

    let agent_model = agents::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        agent_id: Set(agent_id.clone()),
        display_name: Set(display_name),
        image: Set(image),
        entrypoint: Set(req.entrypoint),
        env_vars: Set(serde_json::to_string(&req.env_vars).unwrap_or_else(|_| "{}".to_string())),
        livekit_permissions: Set(
            serde_json::to_string(&req.livekit_permissions).unwrap_or_else(|_| "{}".to_string())
        ),
        default_room_behavior: Set(default_room_behavior),
        auto_restart_policy: Set(auto_restart_policy),
        resource_limits: Set(serde_json::to_string(&resource_limits).unwrap_or_else(|_| "{}".to_string())),
        is_enabled: Set(true),
        project_id: Set(Some(project_id.clone())),
        ..Default::default()
    };

    let result = agent_model
        .insert(&state.db)
        .await
        .map_err(|e| {
            eprintln!(
                "Failed to create agent in project {} for user {}: {:?}",
                project_id, claims.sub, e
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(AgentResponse {
        id: result.id,
        agent_id: result.agent_id,
        display_name: result.display_name,
        image: result.image,
        entrypoint: result.entrypoint,
        env_vars: parse_json_or_default(&result.env_vars),
        livekit_permissions: parse_json_or_default(&result.livekit_permissions),
        default_room_behavior: result.default_room_behavior,
        auto_restart_policy: result.auto_restart_policy,
        resource_limits: parse_json_or_default(&result.resource_limits),
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
        agent.env_vars = Set(serde_json::to_string(&env_vars).unwrap_or_else(|_| "{}".to_string()));
    }
    if let Some(permissions) = req.livekit_permissions {
        agent.livekit_permissions =
            Set(serde_json::to_string(&permissions).unwrap_or_else(|_| "{}".to_string()));
    }
    if let Some(behavior) = req.default_room_behavior {
        agent.default_room_behavior = Set(behavior);
    }
    if let Some(policy) = req.auto_restart_policy {
        agent.auto_restart_policy = Set(policy);
    }
    if let Some(limits) = req.resource_limits {
        agent.resource_limits = Set(serde_json::to_string(&limits).unwrap_or_else(|_| "{}".to_string()));
    }
    if let Some(enabled) = req.is_enabled {
        agent.is_enabled = Set(enabled);
    }
    if let Some(status) = req.status {
        let normalized = status.trim().to_ascii_lowercase();
        if normalized == "active" || normalized == "running" || normalized == "enabled" {
            agent.is_enabled = Set(true);
        } else if normalized == "paused" || normalized == "inactive" || normalized == "disabled" {
            agent.is_enabled = Set(false);
        }
    }

    let result = agent.update(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AgentResponse {
        id: result.id,
        agent_id: result.agent_id,
        display_name: result.display_name,
        image: result.image,
        entrypoint: result.entrypoint,
        env_vars: parse_json_or_default(&result.env_vars),
        livekit_permissions: parse_json_or_default(&result.livekit_permissions),
        default_room_behavior: result.default_room_behavior,
        auto_restart_policy: result.auto_restart_policy,
        resource_limits: parse_json_or_default(&result.resource_limits),
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
        id: agent.id,
        agent_id: agent.agent_id,
        display_name: agent.display_name,
        image: agent.image,
        entrypoint: agent.entrypoint,
        env_vars: parse_json_or_default(&agent.env_vars),
        livekit_permissions: parse_json_or_default(&agent.livekit_permissions),
        default_room_behavior: agent.default_room_behavior,
        auto_restart_policy: agent.auto_restart_policy,
        resource_limits: parse_json_or_default(&agent.resource_limits),
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

    let deployment_type = if req.deployment_type.trim().is_empty() {
        env::var("AGENT_DEFAULT_DEPLOYMENT")
            .unwrap_or_else(|_| "docker".to_string())
            .trim()
            .to_ascii_lowercase()
    } else {
        req.deployment_type.trim().to_ascii_lowercase()
    };

    if deployment_type == "docker" {
        let docker_ready = Command::new("docker")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false);
        if !docker_ready {
            eprintln!(
                "Docker deployment requested for agent {}, but docker CLI/daemon is unavailable in backend runtime.",
                agent.agent_id
            );
            return Err(StatusCode::FAILED_DEPENDENCY);
        }
    }

    match deployment_type.as_str() {
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
    let livekit_url = env::var("LIVEKIT_URL").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let livekit_api_key = env::var("LIVEKIT_API_KEY").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let livekit_api_secret = env::var("LIVEKIT_API_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Prepare environment variables
    let mut env_vars = vec![
        format!("LIVEKIT_URL={}", livekit_url),
        format!("LIVEKIT_API_KEY={}", livekit_api_key),
        format!("LIVEKIT_API_SECRET={}", livekit_api_secret),
        format!("LIVEKIT_AGENT_TOKEN={}", agent_token),
        format!("AGENT_INSTANCE_ID={}", instance_id),
    ];

    // Add custom env vars
    if let Ok(custom_env) =
        serde_json::from_str::<std::collections::HashMap<String, String>>(&agent.env_vars)
    {
        for (key, value) in custom_env {
            env_vars.push(format!("{}={}", key, value));
        }
    }

    if let Some(room) = room_name {
        env_vars.push(format!("LIVEKIT_ROOM={}", room));
    }

    // Build Docker run command
    let mut cmd = Command::new("docker");
    let docker_network = env::var("AGENT_DOCKER_NETWORK")
        .unwrap_or_else(|_| "livekit-core_livekit-network".to_string());

    cmd.arg("run")
        .arg("-d")
        .arg("--name")
        .arg(format!("livekit-agent-{}", instance_id))
        .arg("--network")
        .arg(docker_network);

    // Add environment variables
    for env_var in env_vars {
        cmd.arg("-e").arg(env_var);
    }

    // Add resource limits if specified
    if let Ok(limits) =
        serde_json::from_str::<crate::models::agents::ResourceLimits>(&agent.resource_limits)
    {
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
        .map_err(|e| {
            eprintln!(
                "Failed to execute docker run for agent {} instance {}: {:?}",
                agent.agent_id, instance_id, e
            );
            StatusCode::FAILED_DEPENDENCY
        })?;

    if !output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!(
            "docker run failed for agent {} instance {}. stdout={} stderr={}",
            agent.agent_id,
            instance_id,
            stdout,
            stderr
        );
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Create instance record
    let instance_model = agent_instances::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        agent_id: Set(agent.id.clone()),
        instance_id: Set(instance_id.to_string()),
        container_id: Set(Some(container_id.clone())),
        status: Set("running".to_string()),
        started_at: Set(Some(chrono::Utc::now().naive_utc())),
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
    let livekit_url = env::var("LIVEKIT_URL").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let livekit_api_key = env::var("LIVEKIT_API_KEY").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let livekit_api_secret = env::var("LIVEKIT_API_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Prepare environment variables
    let mut env_vars = std::collections::HashMap::new();
    env_vars.insert("LIVEKIT_URL".to_string(), livekit_url);
    env_vars.insert("LIVEKIT_API_KEY".to_string(), livekit_api_key);
    env_vars.insert("LIVEKIT_API_SECRET".to_string(), livekit_api_secret);
    env_vars.insert("LIVEKIT_AGENT_TOKEN".to_string(), agent_token);
    env_vars.insert("AGENT_INSTANCE_ID".to_string(), instance_id.to_string());

    // Add custom env vars
    if let Ok(custom_env) =
        serde_json::from_str::<std::collections::HashMap<String, String>>(&agent.env_vars)
    {
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
        id: Set(Uuid::new_v4().to_string()),
        agent_id: Set(agent.id.clone()),
        instance_id: Set(instance_id.to_string()),
        process_pid: Set(Some(pid as i32)),
        status: Set("running".to_string()),
        started_at: Set(Some(chrono::Utc::now().naive_utc())),
        ..Default::default()
    };

    let instance_db = instance_model.insert(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Spawn a task to manage the process and log its output
    let db = state.db.clone();
    let instance_db_id = instance_db.id;
    let agent_id_clone = agent.id.clone();
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
                        let _ = crate::handlers::agents::logs::store_agent_log_by_id(
                            &db,
                            agent_id_clone.clone(),
                            instance_db_id.clone(),
                            "INFO",
                            &line
                        ).await;
                    } else { break; }
                }
                line = stderr_reader.next_line() => {
                    if let Ok(Some(line)) = line {
                        let _ = crate::handlers::agents::logs::store_agent_log_by_id(
                            &db,
                            agent_id_clone.clone(),
                            instance_db_id.clone(),
                            "ERROR",
                            &line
                        ).await;
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
    let permissions =
        serde_json::from_str::<crate::models::agents::AgentPermissions>(&agent.livekit_permissions)
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

async fn force_remove_container(container_id: &str) {
    match Command::new("docker")
        .arg("rm")
        .arg("-f")
        .arg(container_id)
        .output()
        .await
    {
        Ok(output) if output.status.success() => {}
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            eprintln!(
                "Failed to remove container {} during agent cleanup: {}",
                container_id, stderr
            );
        }
        Err(err) => {
            eprintln!(
                "Failed to execute docker rm for container {} during agent cleanup: {:?}",
                container_id, err
            );
        }
    }
}

async fn terminate_process(pid: i32) {
    if cfg!(windows) {
        let _ = Command::new("taskkill")
            .arg("/PID")
            .arg(pid.to_string())
            .arg("/T")
            .arg("/F")
            .output()
            .await;
        return;
    }

    let pid_str = pid.to_string();
    let term = Command::new("kill")
        .arg("-TERM")
        .arg(&pid_str)
        .output()
        .await;
    if let Ok(output) = term {
        if output.status.success() {
            return;
        }
    }

    let _ = Command::new("kill")
        .arg("-KILL")
        .arg(&pid_str)
        .output()
        .await;
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
        id: agent.id,
        agent_id: agent.agent_id,
        display_name: agent.display_name,
        image: agent.image,
        entrypoint: agent.entrypoint,
        env_vars: parse_json_or_default(&agent.env_vars),
        livekit_permissions: parse_json_or_default(&agent.livekit_permissions),
        default_room_behavior: agent.default_room_behavior,
        auto_restart_policy: agent.auto_restart_policy,
        resource_limits: parse_json_or_default(&agent.resource_limits),
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

    let active_instances = agent_instances::Entity::find()
        .filter(agent_instances::Column::AgentId.eq(agent.id.clone()))
        .all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    for instance in active_instances {
        if let Some(container_id) = instance.container_id {
            force_remove_container(&container_id).await;
            continue;
        }
        if let Some(pid) = instance.process_pid {
            terminate_process(pid).await;
        }
    }

    let active_model: agents::ActiveModel = agent.into();
    active_model.delete(&state.db).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}
