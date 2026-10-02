"""
Canned "week in review" copy shown on a partner's dashboard ("Her Latest
Updates") and its expanded detail view. Not user-generated or clinical
guidance - short, generic, supportive copy keyed by week, phrased with
"may"/"can"/"often" throughout rather than definitive medical claims.
"""

# Pregnancy, keyed by weeks since pregnancy_start_date.
PREGNANCY_MILESTONES: list[dict] = [
    {
        "week": 4, "title": "A tiny beginning",
        "body": "Right now the earliest building blocks of baby are forming, and her body has already started the hormonal shift that powers the whole pregnancy.",
        "expect": ["She may feel more tired than usual", "Early nausea can come and go", "Appointments with her care team are just getting started"],
    },
    {
        "week": 6, "title": "A heartbeat to hear",
        "body": "A heartbeat may now be detectable at a checkup - often the first moment a pregnancy starts to feel real.",
        "expect": ["Morning sickness may show up, any time of day", "Smell sensitivity can spike", "Energy may dip in the afternoons"],
    },
    {
        "week": 8, "title": "Taking shape",
        "body": "Baby is about the size of a raspberry and is starting to take on a more recognizable shape week by week.",
        "expect": ["Nausea and fatigue are often at their strongest", "Clothes may start to feel snug", "Mood can shift along with hormone changes"],
    },
    {
        "week": 10, "title": "Little by little",
        "body": "Most of the early groundwork is done, and baby is moving from the embryonic stage into the fetal stage.",
        "expect": ["Energy may slowly start returning", "Some nausea symptoms can begin to ease", "Her first prenatal screenings may happen around now"],
    },
    {
        "week": 12, "title": "First trimester done",
        "body": "The first trimester is wrapping up - for many, this is when early symptoms start to settle down.",
        "expect": ["Nausea often eases for many people", "Energy levels may start to improve", "This is a common point to share the news"],
    },
    {
        "week": 14, "title": "Settling in",
        "body": "Into the second trimester now, often a steadier stretch after the early weeks.",
        "expect": ["A visible bump may start to show", "Appetite can pick back up", "Skin and hair might look especially good"],
    },
    {
        "week": 16, "title": "Growing steadily",
        "body": "Baby is growing steadily, and a small bump is becoming more noticeable.",
        "expect": ["Some may start to feel the first light movements", "Round ligament pain can come and go", "Energy is often higher through this stretch"],
    },
    {
        "week": 18, "title": "The first flutter",
        "body": "This is often when the very first flutters of movement start to be felt - easy to mistake for something else at first.",
        "expect": ["Flutters may be felt for the first time", "A mid-pregnancy scan is often scheduled around now", "Back and hip discomfort can begin"],
    },
    {
        "week": 20, "title": "Halfway there",
        "body": "Halfway through - baby's movements are becoming easier to recognize, and the anatomy scan often happens around this week.",
        "expect": ["Movement becomes more frequent and recognizable", "The anatomy scan may reveal baby's sex, if wanted", "Sleep can get trickier as the bump grows"],
    },
    {
        "week": 22, "title": "Feeling her move",
        "body": "Movement is usually unmistakable by now, with kicks and rolls becoming part of the daily rhythm.",
        "expect": ["Kicks and rolls are more noticeable", "Braxton Hicks (practice) contractions may start", "Appetite often increases"],
    },
    {
        "week": 24, "title": "Baby is growing",
        "body": "Baby is growing fast, with hearing developing enough to start responding to sound.",
        "expect": ["Baby may react to loud sounds or music", "A glucose screening is often done around now", "Swelling in feet and ankles can start"],
    },
    {
        "week": 26, "title": "Getting stronger",
        "body": "Baby keeps getting stronger, with more defined sleep and wake cycles.",
        "expect": ["She may notice patterns in baby's active times", "Back pain can become more noticeable", "Shortness of breath may start as baby grows"],
    },
    {
        "week": 28, "title": "Third trimester begins",
        "body": "The third trimester begins - the final stretch, with more frequent checkups ahead.",
        "expect": ["Appointments usually become more frequent", "Braxton Hicks contractions may be more noticeable", "Fatigue can return as the body works harder"],
    },
    {
        "week": 30, "title": "Almost there",
        "body": "Getting closer now, with baby packing on weight and settling into position.",
        "expect": ["Baby may start settling head-down", "Sleep can be harder to come by", "Heartburn is common at this stage"],
    },
    {
        "week": 32, "title": "Getting ready",
        "body": "Baby is getting ready, with less room to move but plenty of activity still.",
        "expect": ["Movements may feel stronger but less spacious", "Swelling and discomfort can increase", "Hospital bag prep often starts around now"],
    },
    {
        "week": 34, "title": "Final stretch",
        "body": "The final stretch - baby is nearly ready, and appointments often become weekly.",
        "expect": ["Checkups may move to a weekly schedule", "Braxton Hicks contractions can increase", "Rest becomes more important than ever"],
    },
    {
        "week": 36, "title": "Nearly full term",
        "body": "Nearly full term - baby could arrive any time from here on.",
        "expect": ["Baby is considered close to term", "Lightening (baby dropping) may happen", "Pressure low in the belly can increase"],
    },
    {
        "week": 38, "title": "Any day now",
        "body": "Any day now - everything is in place and it's just a matter of when.",
        "expect": ["Labor signs can start at any time", "Nesting energy may show up suddenly", "Rest and staying reachable both matter now"],
    },
    {
        "week": 40, "title": "Full term",
        "body": "Full term has arrived. However it happens, this is the week everyone's been waiting for.",
        "expect": ["Baby is considered full term", "Labor could start at any moment", "Staying close and ready to help matters most"],
    },
]

# Postpartum, keyed by weeks since baby_age start.
NEWMOM_MILESTONES: list[dict] = [
    {
        "week": 0, "title": "Welcome to the world",
        "body": "The very first days are a whirlwind of recovery, feeding, and getting to know each other.",
        "expect": ["Rest matters more than almost anything else", "Feeding routines are still being figured out", "Visitors should take cues from her, not the other way around"],
    },
    {
        "week": 1, "title": "The first week",
        "body": "One week in, and everything - her body, her sleep, her days - is adjusting fast.",
        "expect": ["Sleep comes in short, unpredictable bursts", "Postpartum soreness is still very present", "Emotions can swing without warning"],
    },
    {
        "week": 2, "title": "Finding a rhythm",
        "body": "Two weeks postpartum, and the first signs of a routine are starting to appear.",
        "expect": ["A loose feeding/sleep pattern may be emerging", "Energy is still low most days", "Extra hands around the house help a lot"],
    },
    {
        "week": 4, "title": "One month strong",
        "body": "A full month in - a real milestone, even on the hardest days.",
        "expect": ["Healing is progressing, but still ongoing", "A postpartum checkup is often due around now", "Support still matters just as much as week one"],
    },
    {
        "week": 6, "title": "Settling into routine",
        "body": "Six weeks postpartum often marks a turning point, with routines feeling a little more familiar.",
        "expect": ["Her 6-week checkup may happen around now", "Energy can start to return gradually", "Mood changes are worth paying attention to"],
    },
    {
        "week": 8, "title": "Two months in",
        "body": "Two months in, and the day-to-day is starting to feel a little more manageable.",
        "expect": ["Sleep may still be inconsistent", "A smile or early social cues might appear", "She may be thinking about returning to normal routines"],
    },
    {
        "week": 12, "title": "Three months of growth",
        "body": "Three months in - both baby and mom have come a long way since day one.",
        "expect": ["Some return to regular activities may be happening", "Energy levels are often improving", "Check in on how she's really doing, not just baby"],
    },
    {
        "week": 16, "title": "Four months along",
        "body": "Four months postpartum, with daily life settling into its own new normal.",
        "expect": ["Sleep patterns are often more predictable", "She may be easing back into work or routines", "Emotional check-ins are still worth making"],
    },
    {
        "week": 20, "title": "Five months of memories",
        "body": "Five months in, and there's likely a comfortable rhythm to most days now.",
        "expect": ["Baby's schedule may be more established", "She may feel more like herself again", "Small gestures of support still go a long way"],
    },
    {
        "week": 24, "title": "Half a year together",
        "body": "Six months together - a real milestone worth marking.",
        "expect": ["Day-to-day life likely feels steadier", "Energy and mood are often more stable", "This is a good time to check in on how she's really feeling"],
    },
]


def get_latest_updates(status: str, current_week: int, limit: int = 4) -> list[dict]:
    """Up to `limit` milestones at or before `current_week`, most recent first."""
    table = PREGNANCY_MILESTONES if status == 'pregnant' else NEWMOM_MILESTONES
    passed = [m for m in table if m["week"] <= current_week]
    passed.sort(key=lambda m: m["week"], reverse=True)
    return passed[:limit]
