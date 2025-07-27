from typing import List
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from bson import ObjectId
from datetime import datetime

from models import PromptCreate, PromptResponse, PromptWithResults
from database import (
    get_collection,
    PROMPTS_COLLECTION,
    SESSIONS_COLLECTION,
    PINS_COLLECTION,
)
from services.pinterest_service import run_pinterest_workflow

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.post("/", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt(prompt: PromptCreate):
    """Create a new visual prompt."""
    try:
        collection = get_collection(PROMPTS_COLLECTION)

        # Create prompt document
        prompt_doc = {
            "text": prompt.text,
            "created_at": datetime.utcnow(),
            "status": "pending",
        }

        result = await collection.insert_one(prompt_doc)

        # Return the created prompt
        created_prompt = await collection.find_one({"_id": result.inserted_id})

        return PromptResponse(
            id=str(created_prompt["_id"]),
            text=created_prompt["text"],
            created_at=created_prompt["created_at"],
            status=created_prompt["status"],
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create prompt: {str(e)}",
        )


@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt(prompt_id: str):
    """Get a specific prompt by ID."""
    try:
        if not ObjectId.is_valid(prompt_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid prompt ID format",
            )

        collection = get_collection(PROMPTS_COLLECTION)
        prompt = await collection.find_one({"_id": ObjectId(prompt_id)})

        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found"
            )

        return PromptResponse(
            id=str(prompt["_id"]),
            text=prompt["text"],
            created_at=prompt["created_at"],
            status=prompt["status"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve prompt: {str(e)}",
        )


@router.get("/", response_model=List[PromptResponse])
async def list_prompts(skip: int = 0, limit: int = 10):
    """List all prompts with pagination."""
    try:
        collection = get_collection(PROMPTS_COLLECTION)
        cursor = collection.find().sort("created_at", -1).skip(skip).limit(limit)

        prompts = []
        async for prompt in cursor:
            prompts.append(
                PromptResponse(
                    id=str(prompt["_id"]),
                    text=prompt["text"],
                    created_at=prompt["created_at"],
                    status=prompt["status"],
                )
            )

        return prompts

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve prompts: {str(e)}",
        )


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt(prompt_id: str):
    """Delete a prompt and all associated data."""
    try:
        if not ObjectId.is_valid(prompt_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid prompt ID format",
            )

        # Delete prompt
        prompts_collection = get_collection(PROMPTS_COLLECTION)
        result = await prompts_collection.delete_one({"_id": ObjectId(prompt_id)})

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found"
            )

        # Delete associated sessions and pins
        sessions_collection = get_collection(SESSIONS_COLLECTION)
        pins_collection = get_collection(PINS_COLLECTION)

        await sessions_collection.delete_many({"prompt_id": prompt_id})
        await pins_collection.delete_many({"prompt_id": prompt_id})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete prompt: {str(e)}",
        )


@router.post("/{prompt_id}/start-workflow", status_code=status.HTTP_202_ACCEPTED)
async def start_pinterest_workflow(prompt_id: str, background_tasks: BackgroundTasks):
    """Start the Pinterest workflow (warm-up + scraping) for a prompt."""
    try:
        if not ObjectId.is_valid(prompt_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid prompt ID format",
            )

        # Check if prompt exists
        collection = get_collection(PROMPTS_COLLECTION)
        prompt = await collection.find_one({"_id": ObjectId(prompt_id)})

        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found"
            )

        # Update prompt status to processing
        await collection.update_one(
            {"_id": ObjectId(prompt_id)}, {"$set": {"status": "processing"}}
        )

        # Start Pinterest workflow in background
        background_tasks.add_task(run_pinterest_workflow, prompt_id, prompt["text"])

        return {
            "message": "Pinterest workflow started",
            "prompt_id": prompt_id,
            "status": "processing",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start workflow: {str(e)}",
        )
