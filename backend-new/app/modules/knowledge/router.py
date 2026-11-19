"""Knowledge-base admin API (staff with `knowledge.manage`). Mounted at /api/v1/knowledge."""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.ai_chat import audit
from app.modules.knowledge import service
from app.modules.knowledge.models import KnowledgeDoc
from app.modules.staff.deps import StaffContext, require_permission

router = APIRouter()
_perm = require_permission("knowledge.manage")


class DocIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=20, max_length=8000)
    source: str = Field(..., min_length=3, max_length=200)
    source_url: Optional[str] = Field(None, max_length=500)
    published_on: Optional[date] = None
    expires_on: Optional[date] = None
    stages: List[str] = []
    week_from: Optional[int] = Field(None, ge=0, le=60)
    week_to: Optional[int] = Field(None, ge=0, le=60)
    tags: List[str] = []


class DocEdit(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    body: Optional[str] = Field(None, min_length=20, max_length=8000)
    source: Optional[str] = Field(None, min_length=3, max_length=200)
    source_url: Optional[str] = Field(None, max_length=500)
    published_on: Optional[date] = None
    expires_on: Optional[date] = None
    stages: Optional[List[str]] = None
    week_from: Optional[int] = Field(None, ge=0, le=60)
    week_to: Optional[int] = Field(None, ge=0, le=60)
    tags: Optional[List[str]] = None


class ApproveIn(BaseModel):
    reviewer: str = Field(..., min_length=3, max_length=120, description="Name and role of the clinician who reviewed it")
    expires_on: Optional[date] = None


async def _doc(db, doc_id: int) -> KnowledgeDoc:
    doc = await db.get(KnowledgeDoc, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/docs")
async def list_docs(status: Optional[str] = None, staff: StaffContext = Depends(_perm), db: AsyncSession = Depends(get_db)):
    q = select(KnowledgeDoc).order_by(KnowledgeDoc.id)
    if status:
        q = q.where(KnowledgeDoc.status == status)
    return {"success": True, "data": {"docs": [service.as_dict(d) for d in (await db.execute(q)).scalars().all()]}}


@router.post("/docs")
async def create_doc(payload: DocIn, staff: StaffContext = Depends(_perm), db: AsyncSession = Depends(get_db)):
    try:
        doc = await service.create_draft(db, payload.model_dump(), staff.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await audit.record("knowledge.draft", actor=staff.id, doc_id=doc.id)
    return {"success": True, "data": service.as_dict(doc)}


@router.patch("/docs/{doc_id}")
async def edit_doc(doc_id: int, payload: DocEdit, staff: StaffContext = Depends(_perm), db: AsyncSession = Depends(get_db)):
    try:
        doc = await service.edit(db, await _doc(db, doc_id), payload.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await audit.record("knowledge.edit", actor=staff.id, doc_id=doc.id, version=doc.version)
    return {"success": True, "message": "Saved as a new draft version; it needs approval again", "data": service.as_dict(doc)}


@router.post("/docs/{doc_id}/approve")
async def approve_doc(doc_id: int, payload: ApproveIn, staff: StaffContext = Depends(_perm), db: AsyncSession = Depends(get_db)):
    try:
        doc = await service.approve(db, await _doc(db, doc_id), payload.reviewer, payload.expires_on)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await audit.record("knowledge.approve", actor=staff.id, doc_id=doc.id, version=doc.version)
    return {"success": True, "data": service.as_dict(doc)}


@router.post("/docs/{doc_id}/retire")
async def retire_doc(doc_id: int, staff: StaffContext = Depends(_perm), db: AsyncSession = Depends(get_db)):
    doc = await service.retire(db, await _doc(db, doc_id))
    await audit.record("knowledge.retire", actor=staff.id, doc_id=doc.id)
    return {"success": True, "data": service.as_dict(doc)}
