"""End-to-end test for the file reuse-check endpoint (Slice 4 guard E/K).

Stands up the real app via TestClient, then exercises POST /api/files/reuse-check:
  - an unknown file -> known:false (with a content_hash)
  - a file already uploaded to a subject -> known:true + that subject
  - after deleting the subject -> known:false again (orphan guard)
"""
import sys

from fastapi.testclient import TestClient

from app.main import app

SUBJECT_NAME = "ZZ_TEST_SUBJECT_REUSE"
FILE_A = b"Photosynthesis converts light energy into chemical energy in chloroplasts."
FILE_B = b"Newton's laws describe the relationship between force, mass, and motion."


def main() -> int:
    client = TestClient(app)

    # 1. Unknown file -> known:false
    r = client.post("/api/files/reuse-check", files={"file": ("a.txt", FILE_A, "text/plain")})
    assert r.status_code == 200, r.text
    data = r.json()
    print(f"[1] reuse-check unknown file -> {data}")
    assert data["known"] is False, f"expected unknown, got {data}"
    assert data.get("content_hash"), "missing content_hash"

    # 2. Create subject + upload FILE_A
    r = client.post("/api/subjects", json={"name": SUBJECT_NAME, "description": "test"})
    assert r.status_code == 201, r.text
    subject_id = r.json()["id"]
    print(f"[2] create subject -> id={subject_id}")

    try:
        r = client.post(
            f"/api/subjects/{subject_id}/upload",
            files={"file": ("a.txt", FILE_A, "text/plain")},
        )
        assert r.status_code == 201, r.text
        assert r.json()["processing_status"] == "done"
        print("[2] uploaded FILE_A")

        # 3. Same file again -> known:true, points at the subject
        r = client.post("/api/files/reuse-check", files={"file": ("a.txt", FILE_A, "text/plain")})
        assert r.status_code == 200, r.text
        data = r.json()
        print(f"[3] reuse-check known file -> {data}")
        assert data["known"] is True, f"expected known, got {data}"
        assert data["existing_subject_id"] == subject_id, f"wrong subject: {data}"
        assert data["existing_subject_name"] == SUBJECT_NAME
        assert data["already_processed"] is True

        # 4. Different file -> still unknown
        r = client.post("/api/files/reuse-check", files={"file": ("b.txt", FILE_B, "text/plain")})
        assert r.status_code == 200, r.text
        data = r.json()
        print(f"[4] reuse-check different file -> {data}")
        assert data["known"] is False, f"expected unknown for FILE_B, got {data}"

        # 5. Delete subject -> FILE_A becomes unknown again (orphan guard)
        r = client.delete(f"/api/subjects/{subject_id}")
        assert r.status_code == 204, r.text
        r = client.post("/api/files/reuse-check", files={"file": ("a.txt", FILE_A, "text/plain")})
        assert r.status_code == 200, r.text
        data = r.json()
        print(f"[5] reuse-check after delete -> {data}")
        assert data["known"] is False, f"orphaned material still reported known: {data}"
        print("[5] orphaned material correctly reported unknown")
    except Exception as e:
        print("TEST FAILED:", repr(e))
        try:
            client.delete(f"/api/subjects/{subject_id}")
        except Exception:
            pass
        return 1

    print("\nALL_TESTS_PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
