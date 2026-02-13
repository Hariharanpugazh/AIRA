use axum::{extract::{State, Extension}, Json, http::StatusCode};
use sea_orm::{
    ActiveModelTrait,
    ColumnTrait,
    EntityTrait,
    QueryFilter,
    Set,
};
use uuid::Uuid;
use regex::Regex;

use crate::entity::users;
use crate::AppState;
use crate::models::auth::{RegisterRequest, LoginRequest};
use crate::utils::password::{hash_password, verify_password};
use crate::utils::jwt::{create_jwt, Claims};
use serde_json::json;

/// Validate email format
fn validate_email(email: &str) -> Result<(), String> {
    // RFC 5322 compliant email regex
    let email_regex = Regex::new(
        r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
    ).unwrap();
    
    if email.is_empty() {
        return Err("Email is required".to_string());
    }
    
    if email.len() > 254 {
        return Err("Email is too long".to_string());
    }
    
    if !email_regex.is_match(email) {
        return Err("Invalid email format".to_string());
    }
    
    Ok(())
}

/// Validate password strength
/// Requirements:
/// - Minimum 12 characters
/// - At least one uppercase letter
/// - At least one lowercase letter
/// - At least one digit
/// - At least one special character
fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 12 {
        return Err("Password must be at least 12 characters long".to_string());
    }
    
    if password.len() > 128 {
        return Err("Password is too long".to_string());
    }
    
    let has_uppercase = password.chars().any(|c| c.is_ascii_uppercase());
    let has_lowercase = password.chars().any(|c| c.is_ascii_lowercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    let has_special = password.chars().any(|c| !c.is_ascii_alphanumeric());
    
    if !has_uppercase {
        return Err("Password must contain at least one uppercase letter".to_string());
    }
    
    if !has_lowercase {
        return Err("Password must contain at least one lowercase letter".to_string());
    }
    
    if !has_digit {
        return Err("Password must contain at least one digit".to_string());
    }
    
    if !has_special {
        return Err("Password must contain at least one special character".to_string());
    }
    
    // Check for common weak passwords
    let common_passwords = ["password", "123456", "qwerty", "admin", "letmein"];
    let password_lower = password.to_lowercase();
    for common in &common_passwords {
        if password_lower.contains(common) {
            return Err("Password is too common or easily guessable".to_string());
        }
    }
    
    Ok(())
}

/// Validate user name
fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Name is required".to_string());
    }
    
    if name.len() < 2 {
        return Err("Name must be at least 2 characters long".to_string());
    }
    
    if name.len() > 100 {
        return Err("Name is too long".to_string());
    }
    
    // Check for valid characters (letters, spaces, hyphens, apostrophes)
    let name_regex = Regex::new(r"^[\p{L}\s\-'\.]+$").unwrap();
    if !name_regex.is_match(name) {
        return Err("Name contains invalid characters".to_string());
    }
    
    Ok(())
}

/// Validate phone number
fn validate_phone(phone: &str) -> Result<(), String> {
    if phone.is_empty() {
        return Ok(()); // Phone is optional
    }
    
    // E.164 format validation (optional + followed by 10-15 digits)
    let phone_regex = Regex::new(r"^\+?[1-9]\d{9,14}$").unwrap();
    
    // Remove common formatting characters for validation
    let cleaned: String = phone.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect();
    
    if !phone_regex.is_match(&cleaned) {
        return Err("Invalid phone number format. Use E.164 format (+1234567890)".to_string());
    }
    
    Ok(())
}

// ---------------- REGISTER ----------------

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Validate all input fields
    if let Err(e) = validate_email(&payload.email) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Validation failed", "message": e, "field": "email" }))
        ));
    }
    
    if let Err(e) = validate_password(&payload.password) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Validation failed", "message": e, "field": "password" }))
        ));
    }
    
    if let Err(e) = validate_name(&payload.name) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Validation failed", "message": e, "field": "name" }))
        ));
    }
    
    if let Err(e) = validate_phone(&payload.phone) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Validation failed", "message": e, "field": "phone" }))
        ));
    }

    // Check for existing user
    let existing_user = users::Entity::find()
        .filter(users::Column::Email.eq(&payload.email))
        .one(&state.db)
        .await
        .map_err(|e| {
            eprintln!("DB error fetching existing user: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Database error", "message": "Failed to check existing user" }))
            )
        })?;

    if existing_user.is_some() {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({ "error": "Conflict", "message": "Email already exists" }))
        ));
    }

    // Hash password with Argon2
    let hashed_password = hash_password(&payload.password);

    let user_id = Uuid::new_v4().to_string();

    let new_user = users::ActiveModel {
        id: Set(user_id),
        email: Set(payload.email.clone()),
        name: Set(Some(payload.name.clone())),
        phone: Set(Some(payload.phone.clone())),
        password: Set(hashed_password),
        role_id: Set(Some("role_admin".to_string())),
        is_active: Set(true),
        created_at: Set(chrono::Utc::now().naive_utc()),
        updated_at: Set(chrono::Utc::now().naive_utc()),
        ..Default::default()
    };

    new_user.insert(&state.db).await.map_err(|e| {
        eprintln!("DB error inserting new user: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Database error", "message": "Failed to create user" }))
        )
    })?;

    tracing::info!("User registered successfully: {}", payload.email);

    Ok(Json(json!({
        "success": true,
        "message": "User registered successfully"
    })))
}

// ---------------- LOGIN ----------------

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Validate email format
    if let Err(e) = validate_email(&payload.email) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Validation failed", "message": e, "field": "email" }))
        ));
    }
    
    // Check for empty password
    if payload.password.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Validation failed", "message": "Password is required", "field": "password" }))
        ));
    }

    let user = users::Entity::find()
        .filter(users::Column::Email.eq(&payload.email))
        .one(&state.db)
        .await
        .map_err(|e| {
            eprintln!("DB error during login: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Database error", "message": "Authentication failed" }))
            )
        })?;

    let user = match user {
        Some(u) => u,
        None => {
            tracing::warn!("Login attempt for non-existent user: {}", payload.email);
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Authentication failed", "message": "Invalid email or password" }))
            ));
        }
    };

    // Check if user is active
    if !user.is_active {
        tracing::warn!("Login attempt for inactive user: {}", payload.email);
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Account disabled", "message": "Your account has been disabled" }))
        ));
    }

    // Verify password with Argon2
    if !verify_password(&user.password, &payload.password) {
        tracing::warn!("Failed login attempt for user: {}", payload.email);
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Authentication failed", "message": "Invalid email or password" }))
        ));
    }

    // Check for role
    let is_admin = if let Some(role_id) = &user.role_id {
        if let Ok(Some(role)) = crate::entity::prelude::Roles::find_by_id(role_id).one(&state.db).await {
            role.name == "Administrator" || role.name == "Owner" || role.is_system
        } else {
            false
        }
    } else {
        false
    };

    let user_name = user.name.clone().unwrap_or_default();
    let token = create_jwt(user.id.clone(), is_admin, user.email.clone(), user_name);
    
    tracing::info!("User logged in successfully: {}", payload.email);

    Ok(Json(json!({
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": 86400, // 24 hours
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_admin": is_admin
        }
    })))
}

// ---------------- ME ----------------

pub async fn me(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Return user info directly from the JWT claims so frontend can display account
    Ok(Json(json!({
        "id": claims.sub,
        "email": claims.email,
        "name": claims.name,
        "is_admin": claims.is_admin
    })))
}
