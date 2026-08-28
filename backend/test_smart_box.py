"""End-to-end test for the smart study box foundation (Slices 0, 0.5, 1).

Stands up the real app via TestClient (which runs init_db + the content_hash
migration on startup), then exercises:
  - upload stores a content_hash (Slice 0)
  - /api/search/source matches the correct subject with a confidence score (Slice 1)
  - deleting the subject purges its vectors, so it no longer matches (Slice 0.5)
"""
import asyncio
import sys

from fastapi.testclient import TestClient

from app.database import AsyncSessionLocal, Material, select
from app.main import app

SUBJECT_NAME = "ZZ_TEST_SUBJECT_MITO"
FILE_CONTENT = (
    b"Mitochondria are the powerhouse of the cell. They generate ATP through "
    b"cellular respiration using oxygen and glucose. The Krebs cycle occurs in "
    b"the mitochondrial matrix."
)
QUESTION = "What do mitochondria do?"


async def get_hash(subject_id: int):
    async with AsyncSessionLocal() as s:
        res = await s.execute(select(Material).where(Material.subject_id == subject_id))
        m = res.scalars().first()
        return m.content_hash if m else None


def main() -> int:
    client = TestClient(app)

    # 1. Create subject
    r = client.post("/api/subjects", json={"name": SUBJECT_NAME, "description": "test"})
    assert r.status_code == 201, r.text
    subject_id = r.json()["id"]
    print(f"[1] create subject -> id={subject_id}")

    try:
        # 2. Upload material (UTF-8 text, no OCR/AI needed)
        r = client.post(
            f"/api/subjects/{subject_id}/upload",
            files={"file": ("mito.txt", FILE_CONTENT, "text/plain")},
        )
        assert r.status_code == 201, r.text
        mat = r.json()
        print(f"[2] upload -> status={mat['processing_status']} chunks={mat['chunks_count']}")
        assert mat["processing_status"] == "done", "upload did not finish processing"

        # 3. content_hash persisted (Slice 0)
        h = asyncio.run(get_hash(subject_id))
        assert h, "content_hash not persisted on upload!"
        print(f"[3] content_hash persisted: {h[:16]}...")

        # 4. Search matches the correct subject (Slice 1)
        r = client.post("/api/search/source", json={"question": QUESTION})
        assert r.status_code == 200, r.text
        data = r.json()
        print(f"[4] search -> {data}")
        assert data.get("matched") is True, f"expected a match, got {data}"
        assert data.get("subject_id") == subject_id, f"matched wrong subject: {data}"
        assert "subject_name" in data and "top_score" in data and "margin" in data
        assert "chunks" not in data, "endpoint leaked chunk content (guard G)"
        print(f"[4] matched correct subject, top_score={data['top_score']}, margin={data['margin']}")

        # 5. Delete subject (Slice 0.5: should purge vectors)
        r = client.delete(f"/api/subjects/{subject_id}")
        assert r.status_code == 204, r.text
        print("[5] deleted subject")

        # 6. Search must NOT match the deleted subject's content anymore
        r = client.post("/api/search/source", json={"question": QUESTION})
        assert r.status_code == 200, r.text
        data = r.json()
        print(f"[6] search after delete -> {data}")
        assert not (data.get("matched") and data.get("subject_id") == subject_id), \
            f"deleted subject still matched: {data}"
        print("[6] deleted subject's vectors purged (no match for it)")
    except Exception as e:
        print("TEST FAILED:", repr(e))
        # best-effort cleanup so we don't leave a stray test subject
        try:
            client.delete(f"/api/subjects/{subject_id}")
        except Exception:
            pass
        return 1

    print("\nALL_TESTS_PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
