"""
Curated care content for LoniPlus members. General, supportive guidance phrased with "may" / "can" / "often";
it is not medical advice and every screen says to ask a nurse or doctor when unsure.
"""
from typing import Dict, List, Optional

# ── daily care tasks ─────────────────────────────────────────────────────────
# key, title, subtitle, category (body | nutrition | mind), min_week (pregnancy only)
PREGNANCY_TASKS: List[dict] = [
    {"key": "hydration", "title": "Hydration", "subtitle": "Track your daily water intake", "category": "body"},
    {"key": "prenatal_vitamin", "title": "Prenatal vitamin", "subtitle": "Take your daily supplement", "category": "body"},
    {"key": "gentle_movement", "title": "Gentle movement", "subtitle": "20-minute walk or prenatal yoga", "category": "body"},
    {"key": "pelvic_floor", "title": "Pelvic floor", "subtitle": "Kegel exercises, 3 sets of 10", "category": "body"},
    {"key": "kick_count", "title": "Kick count", "subtitle": "Log baby's movements today", "category": "body", "min_week": 20},
    {"key": "belly_photo", "title": "Belly photo", "subtitle": "Capture your weekly progress", "category": "body"},
    {"key": "breakfast", "title": "Balanced breakfast", "subtitle": "Start with protein and whole grains", "category": "nutrition"},
    {"key": "lunch", "title": "Balanced lunch", "subtitle": "Include vegetables and lean protein", "category": "nutrition"},
    {"key": "dinner", "title": "Balanced dinner", "subtitle": "Light, nutrient-dense evening meal", "category": "nutrition"},
    {"key": "snacks", "title": "Healthy snacks", "subtitle": "2 nutritious snacks between meals", "category": "nutrition"},
    {"key": "mindful_moment", "title": "Mindful moment", "subtitle": "5 minutes of deep breathing or meditation", "category": "mind"},
    {"key": "rest_break", "title": "Rest break", "subtitle": "Lie down and rest for 20 minutes", "category": "mind"},
]

POSTPARTUM_TASKS: List[dict] = [
    {"key": "hydration", "title": "Hydration", "subtitle": "Keep a bottle close, especially when feeding", "category": "body"},
    {"key": "postnatal_vitamin", "title": "Postnatal vitamin", "subtitle": "Take your daily supplement", "category": "body"},
    {"key": "gentle_walk", "title": "Gentle walk", "subtitle": "A short, easy stroll if you feel up to it", "category": "body"},
    {"key": "pelvic_floor", "title": "Pelvic floor", "subtitle": "Gentle Kegels, 3 sets of 10", "category": "body"},
    {"key": "wound_care", "title": "Check in with your body", "subtitle": "Note any pain, bleeding or discomfort", "category": "body"},
    {"key": "breakfast", "title": "Balanced breakfast", "subtitle": "Protein and whole grains for steady energy", "category": "nutrition"},
    {"key": "lunch", "title": "Balanced lunch", "subtitle": "Vegetables, grains and a source of protein", "category": "nutrition"},
    {"key": "dinner", "title": "Balanced dinner", "subtitle": "Something warm and nourishing", "category": "nutrition"},
    {"key": "snacks", "title": "Healthy snacks", "subtitle": "Easy snacks you can eat one-handed", "category": "nutrition"},
    {"key": "mindful_moment", "title": "Mindful moment", "subtitle": "5 minutes of deep breathing", "category": "mind"},
    {"key": "rest_break", "title": "Rest while baby sleeps", "subtitle": "The chores can wait", "category": "mind"},
]


GENERAL_TASKS: List[dict] = [
    {"key": "hydration", "title": "Hydration", "subtitle": "Drink water through the day", "category": "body"},
    {"key": "gentle_movement", "title": "Move your body", "subtitle": "A walk, stretch or workout you enjoy", "category": "body"},
    {"key": "vitamin", "title": "Daily vitamin or supplement", "subtitle": "Only what your clinician advised", "category": "body"},
    {"key": "cycle_log", "title": "Log how you feel", "subtitle": "Mood, energy or period notes, if you track them", "category": "body"},
    {"key": "breakfast", "title": "Balanced breakfast", "subtitle": "Protein and whole grains to start the day", "category": "nutrition"},
    {"key": "lunch", "title": "Balanced lunch", "subtitle": "Vegetables, grains and a source of protein", "category": "nutrition"},
    {"key": "dinner", "title": "Balanced dinner", "subtitle": "Something warm and nourishing", "category": "nutrition"},
    {"key": "snacks", "title": "Healthy snacks", "subtitle": "Fruit, nuts or yoghurt between meals", "category": "nutrition"},
    {"key": "mindful_moment", "title": "Mindful moment", "subtitle": "5 minutes of deep breathing or quiet", "category": "mind"},
    {"key": "sleep_routine", "title": "Wind down for sleep", "subtitle": "Screens off and a calm bedtime routine", "category": "mind"},
]


def tasks_for(kind: str, week: int) -> List[dict]:
    if kind == 'general':
        return list(GENERAL_TASKS)
    catalog = POSTPARTUM_TASKS if kind == 'postpartum' else PREGNANCY_TASKS
    return [t for t in catalog if week >= t.get("min_week", 0)]


# ── nutrition ────────────────────────────────────────────────────────────────
NUTRITION = {
    "pregnancy": {
        "hydration": {"title": "Hydration Goal", "goal_cups": 10, "liters": 2.5,
                      "note": "Water, herbal teas and milk all count"},
        "meals": [
            {"slot": "Breakfast", "name": "Iron-Boost Oatmeal Bowl",
             "description": "Rolled oats cooked with milk, topped with dates, almonds and a drizzle of honey. Served with a side of fresh orange slices."},
            {"slot": "Lunch", "name": "Mediterranean Quinoa Power Bowl",
             "description": "Fluffy quinoa topped with grilled chicken, roasted vegetables, chickpeas, feta and a lemon-tahini dressing."},
            {"slot": "Dinner", "name": "Salmon with Sweet Potato & Greens",
             "description": "Omega-3 rich baked salmon fillet served with roasted sweet potato wedges and sautéed spinach with garlic."},
        ],
        "snacks": [
            {"name": "Greek yogurt with berries", "description": "Plain Greek yogurt topped with mixed berries and a sprinkle of granola.",
             "tags": ["Mixed Berries (1/2 Cup)", "Granola (2 Tbsp)", "Greek Yogurt (3/4 Cup)"]},
            {"name": "Apple slices with almond butter", "description": "Crisp apple slices paired with creamy almond butter for a satisfying, sweet-savoury snack.",
             "tags": ["Apple (1 Medium)", "Almond Butter (2 Tbsp)"]},
        ],
        "avoid": ["Raw Or Undercooked Fish/Shellfish", "Unpasteurized Dairy And Soft Cheeses",
                  "Deli Meats (Unless Heated Until Steaming)", "Raw Sprouts (Alfalfa, Clover)",
                  "Excess Caffeine (Limit To 200mg/Day)", "Alcohol (No Amount Is Proven Safe)"],
    },
    "postpartum": {
        "hydration": {"title": "Hydration Goal", "goal_cups": 12, "liters": 3.0,
                      "note": "Drink to thirst, and a little extra if you are breastfeeding"},
        "meals": [
            {"slot": "Breakfast", "name": "Warm Oats with Banana & Nuts",
             "description": "Slow-cooked oats with sliced banana, walnuts and a spoon of peanut butter for steady energy."},
            {"slot": "Lunch", "name": "Chicken & Vegetable Rice Bowl",
             "description": "Brown rice with shredded chicken, steamed greens and avocado, finished with a squeeze of lime."},
            {"slot": "Dinner", "name": "Lentil & Spinach Stew",
             "description": "Iron-rich lentils simmered with tomatoes and spinach, served with a slice of wholegrain bread."},
        ],
        "snacks": [
            {"name": "Boiled eggs and fruit", "description": "A quick protein-rich snack you can prepare ahead and eat one-handed.",
             "tags": ["Eggs (2)", "Seasonal Fruit (1 Cup)"]},
            {"name": "Yogurt with seeds", "description": "Plain yogurt with a spoon of mixed seeds and honey.",
             "tags": ["Yogurt (3/4 Cup)", "Mixed Seeds (1 Tbsp)"]},
        ],
        "avoid": ["Excess Caffeine", "Alcohol (ask your nurse about timing if breastfeeding)",
                  "Highly processed snacks that leave you drained", "Skipping meals when you are exhausted"],
    },
}

NUTRITION["general"] = {
    "hydration": {"title": "Hydration Goal", "goal_cups": 8, "liters": 2.0, "note": "Water, herbal teas and soups all count"},
    "meals": [
        {"slot": "Breakfast", "name": "Oats, Fruit & Nuts", "description": "Oats cooked with milk or water, topped with banana, groundnuts or almonds and a little honey."},
        {"slot": "Lunch", "name": "Beans, Plantain & Greens", "description": "Beans with a little palm oil, ripe plantain and sautéed leafy greens for iron and fibre."},
        {"slot": "Dinner", "name": "Grilled Fish, Rice & Vegetables", "description": "Grilled fish with brown rice or boiled yam and a colourful vegetable stew."},
    ],
    "snacks": [
        {"name": "Fruit and groundnuts", "description": "A satisfying snack that keeps energy steady.", "tags": ["Seasonal Fruit (1 Cup)", "Groundnuts (small handful)"]},
        {"name": "Yoghurt with seeds", "description": "Plain yoghurt with a spoon of mixed seeds.", "tags": ["Yoghurt (3/4 Cup)", "Mixed Seeds (1 Tbsp)"]},
    ],
    "avoid": ["Too many sugary drinks", "Skipping meals regularly", "Excess alcohol", "Smoking and second-hand smoke"],
}

# ── hospital bag ─────────────────────────────────────────────────────────────
HOSPITAL_BAG: List[dict] = [
    {"id": "documents", "title": "Documents", "items": [
        {"key": "insurance_id", "title": "Insurance card & ID"},
        {"key": "birth_plan", "title": "Birth plan (printed copies)"},
        {"key": "registration_forms", "title": "Hospital registration forms"},
        {"key": "pediatrician", "title": "Pediatrician contact info"},
    ]},
    {"id": "mother", "title": "Mother Essentials", "items": [
        {"key": "robe", "title": "Comfortable robe or nightgown"},
        {"key": "nursing_bras", "title": "Nursing bras"},
        {"key": "toiletries", "title": "Toiletries"},
        {"key": "slippers", "title": "Slippers or non-slip socks"},
        {"key": "charger", "title": "Phone and charger"},
        {"key": "maternity_pads", "title": "Maternity pads"},
        {"key": "going_home_mother", "title": "Loose going-home outfit"},
    ]},
    {"id": "baby", "title": "Baby Essentials", "items": [
        {"key": "diapers", "title": "Newborn diapers and wipes"},
        {"key": "going_home_baby", "title": "Going-home outfit"},
        {"key": "swaddles", "title": "Swaddle blankets"},
        {"key": "hat_mittens", "title": "Hat and mittens"},
        {"key": "car_seat", "title": "Car seat (installed)"},
    ]},
]
BAG_KEYS = {i["key"] for g in HOSPITAL_BAG for i in g["items"]}

# ── labour preparation ───────────────────────────────────────────────────────
LABOUR_DISCLAIMER = "General information, not medical advice. If you are unsure or worried, call your nurse or doctor."

LABOUR_TOPICS: List[dict] = [
    {"slug": "understanding-labour", "title": "Understanding Labour",
     "summary": "Learn what happens to your body during labour and birth.",
     "intro": "Labour is your body's natural process of bringing your baby into the world.",
     "sections": [
         {"heading": "What you need to know",
          "body": "Labour involves rhythmic contractions of your uterus that gradually open your cervix and move your baby down the birth canal. Every labour is unique - some are short and intense, others unfold slowly over many hours."},
         {"heading": "How long does it last?",
          "body": "A first labour often lasts many hours, and later labours are usually shorter, though this varies widely. Subsequent contractions are often stronger and closer together as labour progresses."},
         {"heading": "How to prepare",
          "body": "Learn the signs, pack your hospital bag, plan how you will get to the hospital, and share your preferences with your care team. Preparing mentally helps too: ask questions early and often."},
     ]},
    {"slug": "labour-stages", "title": "Labour Stages",
     "summary": "Understand the three stages of labour and what to expect.",
     "intro": "Labour is usually described in three stages.",
     "sections": [
         {"heading": "Stage 1 - Early to active labour",
          "body": "Contractions open the cervix. Early labour can be mild and irregular; active labour brings stronger, regular contractions. This is the longest stage."},
         {"heading": "Stage 2 - Pushing and birth",
          "body": "Once the cervix is fully open you will feel the urge to push, and your baby is born. Your care team will guide you through each push."},
         {"heading": "Stage 3 - The placenta",
          "body": "Shortly after birth, mild contractions help deliver the placenta. Your team will check you and your baby and help with the first feed if you wish."},
     ]},
    {"slug": "when-to-go-to-hospital", "title": "When to Go to Hospital",
     "summary": "Clear guidelines on timing your hospital arrival.",
     "intro": "Your care team will give you personal advice, and these are common guidelines.",
     "sections": [
         {"heading": "Go when",
          "body": "Contractions are regular and strong, and getting closer together - many providers suggest about 5 minutes apart, lasting a minute, for an hour. Your waters break. You notice bleeding."},
         {"heading": "Go straight away if",
          "body": "You have heavy bleeding, constant severe pain, a severe headache or blurred vision, or baby's movements slow down or stop. Use LONI's Emergency Ride, or call your nurse."},
         {"heading": "Before you leave",
          "body": "Grab your bag and documents, tell your partner or support contact, and note when contractions started and how far apart they are."},
     ]},
    {"slug": "breathing-techniques", "title": "Breathing Techniques",
     "summary": "Master breathing patterns that ease labour pain and keep you calm.",
     "intro": "Slow, steady breathing helps you stay relaxed and can make contractions feel more manageable.",
     "sections": [
         {"heading": "Slow breathing",
          "body": "Breathe in through your nose for a count of four, then out through your mouth for a count of six. Let your shoulders and jaw soften with each out-breath."},
         {"heading": "Patterned breathing",
          "body": "As contractions intensify, some people find light, rhythmic breaths helpful. Practise now, so it feels natural when you need it."},
         {"heading": "Practise daily",
          "body": "Five minutes a day, ideally with your birth partner. Use the Mindful moment in your daily care plan."},
     ]},
]


def labour_topic(slug: str) -> Optional[dict]:
    return next((t for t in LABOUR_TOPICS if t["slug"] == slug), None)
