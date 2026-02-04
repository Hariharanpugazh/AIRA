use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Validation};
use serde::{Serialize, Deserialize};
use chrono::{Utc, Duration};
use std::env;

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

fn jwt_secret() -> String {
    env::var("JWT_SECRET").unwrap_or_else(|_| "SUPER_SECRET_KEY".to_string())
}

pub fn create_jwt(user_id: String) -> String {

    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .unwrap()
        .timestamp() as usize;

    let claims = Claims { sub: user_id, exp: expiration };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_ref()),
    )
    .unwrap()
}

pub fn decode_jwt(token: &str) -> Option<Claims> {
    let validation = Validation::default();
    match decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_ref()),
        &validation,
    ) {
        Ok(data) => Some(data.claims),
        Err(_) => None,
    }
}
