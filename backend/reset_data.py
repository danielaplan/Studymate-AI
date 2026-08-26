import asyncio
from pathlib import Path
from app.database import Base, engine, DB_PATH
import shutil

async def reset():
    # 1. Reset SQLite tables
    print(f"Resetting database at {DB_PATH}...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables recreated cleanly!")

    # 2. Reset uploads directory
    uploads_dir = Path(__file__).parent / "database" / "uploads"
    if uploads_dir.exists():
        for f in uploads_dir.iterdir():
            if f.is_file():
                try:
                    f.unlink()
                except Exception:
                    pass
    print("Uploads folder cleaned.")

    # 3. Reset chroma store
    chroma_dir = Path(__file__).parent / "database" / "chroma_store"
    if chroma_dir.exists():
        try:
            shutil.rmtree(chroma_dir)
            chroma_dir.mkdir(parents=True, exist_ok=True)
            print("Chroma store cleared.")
        except Exception as e:
            print("Chroma clear notice:", e)

    print("App reset complete with zero data.")

if __name__ == "__main__":
    asyncio.run(reset())
