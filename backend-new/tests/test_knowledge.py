"""Knowledge base: nothing reaches mothers without a named reviewer, an expiry date, and a fresh review after any edit."""
from datetime import date, timedelta

import pytest

from app.modules.knowledge import service as kb

pytestmark = pytest.mark.anyio
TODAY = date.today()
DOC = {"title": "Sleep in the third trimester", "body": "Many women sleep badly late in pregnancy. Sleeping on your side "
       "with pillows can help. Tell your midwife if you also have headaches or swelling.", "source": "NHS / WHO (test)",
       "stages": ["pregnancy"], "week_from": 28, "week_to": 42, "tags": ["sleep", "insomnia"]}


async def test_draft_approve_edit_retire_lifecycle(session_factory):
    async with session_factory() as db:
        doc = await kb.create_draft(db, DOC, "staff1")
        assert doc.status == "draft" and kb.rank([doc], "I can't sleep", "pregnancy", 32, TODAY) == []

        with pytest.raises(ValueError):
            await kb.approve(db, doc, "   ", TODAY + timedelta(days=365))        # a named reviewer is required
        with pytest.raises(ValueError):
            await kb.approve(db, doc, "Dr A, OB/GYN", None)                       # and a review-by date
        await kb.approve(db, doc, "Dr A, OB/GYN", TODAY + timedelta(days=365))
        assert [h.doc.id for h in kb.rank([doc], "tips to sleep better", "pregnancy", 32, TODAY)] == [doc.id]

        assert kb.rank([doc], "tips to sleep better", "pregnancy", 12, TODAY) == []          # wrong week
        assert kb.rank([doc], "tips to sleep better", "general", None, TODAY) == []          # wrong stage
        assert kb.rank([doc], "tips to sleep better", "pregnancy", 32, TODAY + timedelta(days=400)) == []   # expired
        assert kb.rank([doc], "what is the weather", "pregnancy", 32, TODAY) == []           # not relevant

        await kb.edit(db, doc, {"body": DOC["body"] + " Avoid sleeping pills unless prescribed."})
        assert doc.status == "draft" and doc.version == 2 and doc.reviewer is None          # edits need a fresh review
        assert kb.rank([doc], "tips to sleep better", "pregnancy", 32, TODAY) == []

        await kb.approve(db, doc, "Dr B, Midwife", None)                                     # keeps the earlier expiry
        await kb.retire(db, doc)
        assert kb.rank([doc], "tips to sleep better", "pregnancy", 32, TODAY) == []


def test_unknown_stage_is_rejected():
    with pytest.raises(ValueError):
        kb.validate_stages(["pregnant"])
