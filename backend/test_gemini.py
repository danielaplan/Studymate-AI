import asyncio
from app.config import get_settings
from google import genai

async def main():
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    for model_name in ["gemini-3.6-flash", "gemini-2.5-flash-lite", "gemini-3.6-pro"]:
        try:
            print(f"Testing model: {model_name}...")
            r = await client.aio.models.generate_content(model=model_name, contents="Hello! Introduce yourself as StudyMate AI in one sentence.")
            print(f"SUCCESS with {model_name}!")
            print("Response:", r.text)
            break
        except Exception as e:
            print(f"Failed on {model_name}:", e)

if __name__ == "__main__":
    asyncio.run(main())
