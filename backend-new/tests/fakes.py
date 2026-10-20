"""A tiny in-memory stand-in for the parts of Mongo (motor) the app uses, with the few query operators we need."""
from types import SimpleNamespace


def _match(doc, query):
    for key, cond in query.items():
        val = doc.get(key)
        if isinstance(cond, dict):
            for op, arg in cond.items():
                if op == "$gte" and not (val is not None and val >= arg):
                    return False
                if op == "$lte" and not (val is not None and val <= arg):
                    return False
                if op == "$in" and val not in arg:
                    return False
                if op == "$ne" and val == arg:
                    return False
        elif val != cond:
            return False
    return True


class FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, key, direction):
        self.docs.sort(key=lambda d: d[key], reverse=direction < 0)
        return self

    def skip(self, n):
        self.docs = self.docs[n:]
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self

    async def to_list(self, length=None):
        return [dict(d) for d in self.docs]


class FakeCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, query, update, upsert=False):
        matched = [d for d in self.docs if _match(d, query)][:1]
        for d in matched:
            d.update(update.get("$set", {}))
        if not matched and upsert:
            self.docs.append({**query, **update.get("$setOnInsert", {}), **update.get("$set", {})})
        return SimpleNamespace(matched_count=len(matched), modified_count=len(matched))

    async def delete_many(self, query):
        keep = [d for d in self.docs if not _match(d, query)]
        n = len(self.docs) - len(keep)
        self.docs = keep
        return SimpleNamespace(deleted_count=n)

    def find(self, query=None):
        return FakeCursor(d for d in self.docs if _match(d, query or {}))


class FakeDb(dict):
    def __missing__(self, key):
        self[key] = FakeCollection()
        return self[key]
