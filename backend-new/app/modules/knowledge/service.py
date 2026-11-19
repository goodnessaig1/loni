"""Curated knowledge base: review workflow and retrieval.

Retrieval is deliberately simple keyword scoring over approved documents, filtered by her stage and pregnancy week.
A clinician-curated KB is small (tens of documents), so this is fast, predictable and easy to audit. Swap in embeddings
only when the KB grows to hundreds of documents; the review workflow and metadata stay the same.
"""
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import List, Optional, Sequence

from sqlalchemy import select

from app.modules.knowledge.models import KnowledgeDoc

STAGES = ("pregnancy", "postpartum", "general", "ttc")
_STOPWORDS = set("""a an and are as at be been but by can could do does for from had has have how i if in into is it its me
my of on or our so that the their them then there these they this to too was we were what when where which who why will
with would you your about should just am im i'm dont don't not no yes any some get got""".split())
_WEEK_IN_QUERY = re.compile(r"\b(\d{1,2})\s*(?:weeks?|wks?)\b", re.I)
MIN_SCORE = 2.0


@dataclass
class Hit:
    doc: KnowledgeDoc
    score: float


def tokens(text: str) -> List[str]:
    return [w for w in re.findall(r"[a-z][a-z\-']+", (text or "").lower()) if w not in _STOPWORDS and len(w) > 2]


def servable(doc: KnowledgeDoc, today: date) -> bool:
    """Approved, has a named reviewer, and not past its review-by date."""
    return doc.status == "approved" and bool(doc.reviewer) and (doc.expires_on is None or doc.expires_on >= today)


def _stage_ok(doc: KnowledgeDoc, kind: Optional[str], week: Optional[int]) -> bool:
    if doc.stages and kind not in doc.stages:
        return False
    if week is not None and (doc.week_from is not None or doc.week_to is not None):
        lo = doc.week_from if doc.week_from is not None else 0
        hi = doc.week_to if doc.week_to is not None else 99
        return lo <= week <= hi
    return True


def score(doc: KnowledgeDoc, q: Sequence[str], asked_week: Optional[int]) -> float:
    title = set(tokens(doc.title))
    tags = {t.lower() for t in (doc.tags or [])}
    body = tokens(doc.body)
    s = 0.0
    for w in set(q):
        if w in tags:
            s += 3
        if w in title:
            s += 2
        s += min(body.count(w), 3) * 0.5
    if asked_week is not None and doc.week_from is not None and doc.week_from <= asked_week <= (doc.week_to or 99):
        s += 3
    return s


def rank(docs: Sequence[KnowledgeDoc], query: str, kind: Optional[str], week: Optional[int], today: date, k: int = 2) -> List[Hit]:
    q = tokens(query)
    m = _WEEK_IN_QUERY.search(query or "")
    asked_week = int(m.group(1)) if m else None
    effective_week = asked_week if asked_week is not None else week
    hits = []
    for d in docs:
        if not servable(d, today) or not _stage_ok(d, kind, effective_week):
            continue
        sc = score(d, q, asked_week)
        if sc >= MIN_SCORE:
            hits.append(Hit(d, sc))
    hits.sort(key=lambda h: (-h.score, h.doc.id))
    return hits[:k]


async def search(db, query: str, kind: Optional[str], week: Optional[int], today: date, k: int = 2) -> List[Hit]:
    docs = (await db.execute(select(KnowledgeDoc).where(KnowledgeDoc.status == "approved"))).scalars().all()
    return rank(docs, query, kind, week, today, k)


def format_for_model(hits: Sequence[Hit]) -> str:
    out = []
    for h in hits:
        d = h.doc
        out.append(f"[{d.title}] (source: {d.source}; version {d.version}; reviewed by {d.reviewer})\n{d.body.strip()}")
    return "\n\n".join(out)


def sources(hits: Sequence[Hit]) -> List[dict]:
    return [{"type": "knowledge", "id": h.doc.id, "title": h.doc.title, "source": h.doc.source, "url": h.doc.source_url,
             "version": h.doc.version} for h in hits]


# ── review workflow ──────────────────────────────────────────────────────────────────────────────────

EDITABLE = ("title", "body", "source", "source_url", "published_on", "expires_on", "stages", "week_from", "week_to", "tags")


def validate_stages(stages) -> List[str]:
    stages = list(stages or [])
    bad = [s for s in stages if s not in STAGES]
    if bad:
        raise ValueError(f"Unknown stage(s): {', '.join(bad)}")
    return stages


async def create_draft(db, data: dict, created_by: str) -> KnowledgeDoc:
    doc = KnowledgeDoc(**{k: data.get(k) for k in EDITABLE if k in data}, status="draft", version=1, created_by=created_by)
    doc.stages = validate_stages(data.get("stages"))
    doc.tags = [str(t).lower()[:40] for t in (data.get("tags") or [])]
    db.add(doc)
    await db.commit()
    return doc


async def edit(db, doc: KnowledgeDoc, data: dict) -> KnowledgeDoc:
    """Any content change sends it back to draft with a new version: nothing changed reaches mothers unreviewed."""
    for k in EDITABLE:
        if k in data and data[k] is not None:
            setattr(doc, k, validate_stages(data[k]) if k == "stages" else data[k])
    doc.version = (doc.version or 1) + 1
    doc.status, doc.reviewer, doc.reviewed_at = "draft", None, None
    await db.commit()
    return doc


async def approve(db, doc: KnowledgeDoc, reviewer: str, expires_on: Optional[date]) -> KnowledgeDoc:
    if not reviewer.strip():
        raise ValueError("A named reviewer is required")
    if expires_on is None and doc.expires_on is None:
        raise ValueError("Set a review-by (expiry) date")
    doc.status, doc.reviewer, doc.reviewed_at = "approved", reviewer.strip()[:120], datetime.now(timezone.utc)
    if expires_on is not None:
        doc.expires_on = expires_on
    await db.commit()
    return doc


async def retire(db, doc: KnowledgeDoc) -> KnowledgeDoc:
    doc.status = "retired"
    await db.commit()
    return doc


def as_dict(d: KnowledgeDoc, today: Optional[date] = None) -> dict:
    today = today or date.today()
    return {"id": d.id, "title": d.title, "body": d.body, "source": d.source, "source_url": d.source_url,
            "published_on": d.published_on.isoformat() if d.published_on else None, "version": d.version, "status": d.status,
            "reviewer": d.reviewer, "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
            "expires_on": d.expires_on.isoformat() if d.expires_on else None, "stages": d.stages or [], "week_from": d.week_from,
            "week_to": d.week_to, "tags": d.tags or [], "served": servable(d, today)}
