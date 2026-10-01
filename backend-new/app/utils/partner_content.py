"""
Canned "week in review" copy shown on a partner's dashboard ("Her Latest
Updates"). Not user-generated - just short, generic milestone titles keyed by
week, same idea as any pregnancy week-by-week tracker.
"""

# (week, title) - pregnancy, keyed by weeks since pregnancy_start_date.
PREGNANCY_MILESTONES: list[tuple[int, str]] = [
    (4, "A tiny beginning"),
    (6, "A heartbeat to hear"),
    (8, "Taking shape"),
    (10, "Little by little"),
    (12, "First trimester done"),
    (14, "Settling in"),
    (16, "Growing steadily"),
    (18, "The first flutter"),
    (20, "Halfway there"),
    (22, "Feeling her move"),
    (24, "Baby is growing"),
    (26, "Getting stronger"),
    (28, "Third trimester begins"),
    (30, "Almost there"),
    (32, "Getting ready"),
    (34, "Final stretch"),
    (36, "Nearly full term"),
    (38, "Any day now"),
    (40, "Full term"),
]

# (week, title) - postpartum, keyed by weeks since baby_age start.
NEWMOM_MILESTONES: list[tuple[int, str]] = [
    (0, "Welcome to the world"),
    (1, "The first week"),
    (2, "Finding a rhythm"),
    (4, "One month strong"),
    (6, "Settling into routine"),
    (8, "Two months in"),
    (12, "Three months of growth"),
    (16, "Four months along"),
    (20, "Five months of memories"),
    (24, "Half a year together"),
]


def get_latest_updates(status: str, current_week: int, limit: int = 4) -> list[dict]:
    """Up to `limit` milestones at or before `current_week`, most recent first."""
    table = PREGNANCY_MILESTONES if status == 'pregnant' else NEWMOM_MILESTONES
    passed = [w for w in table if w[0] <= current_week]
    passed.sort(key=lambda w: w[0], reverse=True)
    return [{"week": week, "title": title} for week, title in passed[:limit]]
