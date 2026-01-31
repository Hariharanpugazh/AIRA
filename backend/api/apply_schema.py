
import asyncio
import asyncpg
import os

DATABASE_URL = "postgresql://admin:Admin2026Secure@localhost:5433/livekit_admin"

async def apply_schema():
    print(f"Connecting to {DATABASE_URL}...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("Connected.")
        
        with open("init.sql", "r") as f:
            schema = f.read()
            
        print("Applying schema...")
        await conn.execute(schema)
        print("Schema applied successfully!")
        
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(apply_schema())
