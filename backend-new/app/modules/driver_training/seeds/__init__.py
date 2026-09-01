import json
import os
from functools import lru_cache
from typing import List, Dict, Any

_SEED_DIR = os.path.dirname(__file__)

APTITUDE_QUESTIONS_FILE = os.path.join(_SEED_DIR, "aptitude_questions.json")
TRAINING_MODULES_FILE = os.path.join(_SEED_DIR, "training_modules.json")


def load_aptitude_questions() -> List[Dict[str, Any]]:
    """Read the bundled aptitude question bank from disk (not cached so a
    re-seed always picks up file edits)."""
    with open(APTITUDE_QUESTIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_training_modules() -> List[Dict[str, Any]]:
    """The training module catalogue is static content served as-is."""
    with open(TRAINING_MODULES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return sorted(data, key=lambda m: m.get("order", 0))
