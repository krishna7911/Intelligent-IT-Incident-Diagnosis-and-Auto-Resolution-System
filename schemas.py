from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Priority = Literal["Low", "Medium", "High", "Critical"]
Status = Literal["Open", "In Progress", "Pending", "Resolved", "Closed"]
Category = Literal["Login & Access", "Network", "Software", "Hardware", "Email", "Security", "General"]


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    specialty: str
    is_active: bool = True


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    specialty: Category = "General"


class AgentWithLoad(AgentOut):
    open_tickets: int = 0


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    author: str
    kind: str
    body: str
    created_at: datetime


class CommentCreate(BaseModel):
    author: str = Field(default="Agent", max_length=100)
    body: str = Field(min_length=1)
    kind: Literal["note", "ai"] = "note"


class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=5)
    requester_name: str = Field(min_length=2, max_length=100)
    requester_email: EmailStr
    category: Optional[Category] = None   # None -> AI decides
    priority: Optional[Priority] = None   # None -> AI decides


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str
    requester_name: str
    requester_email: str
    category: str
    priority: str
    status: str
    ai_confidence: Optional[float] = None
    ai_priority_reason: Optional[str] = None
    agent: Optional[AgentOut] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None


class TicketDetail(TicketOut):
    comments: list[CommentOut] = []


class AssignBody(BaseModel):
    agent_id: Optional[int] = None  # null -> unassign


class PriorityBody(BaseModel):
    priority: Priority


class StatusBody(BaseModel):
    status: Status


class ClassifyBody(BaseModel):
    text: str = Field(min_length=3)


class ChatBody(BaseModel):
    message: str = Field(min_length=1)
