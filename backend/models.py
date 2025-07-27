from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class PromptStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class SessionStage(str, Enum):
    WARMUP = "warmup"
    SCRAPING = "scraping"
    VALIDATION = "validation"


class SessionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class PinStatus(str, Enum):
    APPROVED = "approved"
    DISQUALIFIED = "disqualified"


# Request/Response Models
class PromptCreate(BaseModel):
    text: str = Field(
        ..., min_length=1, max_length=500, description="Visual prompt text"
    )


class PromptResponse(BaseModel):
    id: str
    text: str
    created_at: datetime
    status: PromptStatus


class SessionResponse(BaseModel):
    id: str
    prompt_id: str
    stage: SessionStage
    status: SessionStatus
    timestamp: datetime
    log: List[str]


class PinResponse(BaseModel):
    id: str
    prompt_id: str
    image_url: str
    pin_url: str
    title: str
    description: str
    match_score: float
    status: PinStatus
    ai_explanation: str
    metadata: dict


class PromptWithResults(BaseModel):
    prompt: PromptResponse
    sessions: List[SessionResponse]
    pins: List[PinResponse]


# Database Models (for MongoDB)
class PromptDB(BaseModel):
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: PromptStatus = PromptStatus.PENDING


class SessionDB(BaseModel):
    prompt_id: str
    stage: SessionStage
    status: SessionStatus = SessionStatus.PENDING
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    log: List[str] = Field(default_factory=list)


class PinDB(BaseModel):
    prompt_id: str
    image_url: str
    pin_url: str
    title: str
    description: str
    match_score: float
    status: PinStatus
    ai_explanation: str
    metadata: dict = Field(default_factory=dict)
