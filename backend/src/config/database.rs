use sea_orm::{Database, DatabaseConnection};
use std::env;

pub async fn connect_db() -> DatabaseConnection {

    let url = env::var("DATABASE_URL").unwrap();

    Database::connect(url)
        .await
        .expect("DB connection failed")
}
