from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class ProfileUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    display_name: str = Field(min_length=1, max_length=80)
    bio: str | None = Field(default=None, max_length=300)
    is_private: bool = False

class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    display_name: str
    bio: str | None
    avatar_url: str | None
    cover_url: str | None = None
    is_private: bool

class PostCreate(BaseModel):
    body: str | None = Field(default=None, max_length=10000)
    visibility: str = Field(default="public", pattern="^(public|followers|private)$")

class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    author_id: str
    body: str | None
    visibility: str
    created_at: datetime

class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=3000)

class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    post_id: str
    author_id: str
    body: str
    created_at: datetime


class PostMediaOut(BaseModel):
    url: str
    media_type: str

class PostFeedOut(BaseModel):
    id: str
    author_id: str
    author_name: str
    author_username: str
    avatar_url: str | None = None
    body: str | None
    visibility: str
    created_at: datetime
    likes_count: int = 0
    comments_count: int = 0
    media: list[PostMediaOut] = Field(default_factory=list)
