# StudyMate AI API

## Run locally

```powershell
cd backend
& "C:/Program Files/Python313/python.exe" -m uvicorn app.main:app --reload
```

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to enable Gemini responses. Without a key, the pipeline endpoint returns a local fallback so the mobile-to-backend connection can still be tested.

Endpoints:

- `GET /health`
- `POST /api/test-pipeline` with `{ "message": "..." }`
