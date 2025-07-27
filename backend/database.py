import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Database configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "pinterest_ai"

# Collections
PROMPTS_COLLECTION = "prompts"
SESSIONS_COLLECTION = "sessions"
PINS_COLLECTION = "pins"

# Global database client
client: AsyncIOMotorClient = None
database = None


async def connect_to_mongo():
    """Connect to MongoDB database."""
    global client, database
    client = AsyncIOMotorClient(MONGODB_URI)
    database = client[DATABASE_NAME]
    print(f"Connected to MongoDB: {DATABASE_NAME}")


async def close_mongo_connection():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        print("MongoDB connection closed")


def get_database():
    """Get database instance."""
    return database


def get_collection(collection_name: str):
    """Get collection instance."""
    return database[collection_name]
