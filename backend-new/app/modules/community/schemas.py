from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

POST_MAX = 2000
COMMENT_MAX = 1000


class AuthorOut(BaseModel):
    id: str
    # First name only: a public feed should not expose a mother's full name.
    name: str
    profile_picture: Optional[str] = None


class PostOut(BaseModel):
    id: int
    author: AuthorOut
    body: str
    image_url: Optional[str] = None
    like_count: int
    comment_count: int
    view_count: int
    # The last three distinct viewers, newest first (for the avatar stack).
    recent_viewers: List[AuthorOut] = []
    created_at: datetime
    # Per-recipient flags. Present on REST responses; WebSocket broadcasts omit them and the client
    # derives them (it knows its own id and has not liked a post it has never seen).
    liked_by_me: bool = False
    is_mine: bool = False


class FeedOut(BaseModel):
    items: List[PostOut]
    next_cursor: Optional[str] = None


class CommentOut(BaseModel):
    id: int
    post_id: int
    author: AuthorOut
    body: str
    created_at: datetime
    is_mine: bool = False


class CommentsOut(BaseModel):
    items: List[CommentOut]
    next_cursor: Optional[str] = None


class CreatePostIn(BaseModel):
    body: str = Field(default='', max_length=POST_MAX)
    image_url: Optional[str] = Field(default=None, max_length=500)

    @field_validator('body')
    @classmethod
    def _strip_body(cls, v: str) -> str:
        return v.strip()


class CreateCommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=COMMENT_MAX)

    @field_validator('body')
    @classmethod
    def _strip_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Comment cannot be empty')
        return v


class RecordViewsIn(BaseModel):
    post_ids: List[int] = Field(min_length=1, max_length=50)


class LikeOut(BaseModel):
    liked: bool
    like_count: int


class StatsOut(BaseModel):
    post_id: int
    like_count: int
    comment_count: int
    view_count: int
