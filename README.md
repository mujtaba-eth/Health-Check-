# Sahayog Health

Sahayog Health is a voice-first health screening prototype. It helps a person describe a concern in a short conversation, then turns that conversation into a clear intake summary. It is designed as a starting point for care—not as a diagnostic tool.

## Features

- Guided, turn-by-turn voice conversation with Maya, the virtual health guide
- Browser-based speech recognition and text-to-speech, with a typed fallback
- Context-aware follow-up questions through OpenAI when an API key is configured
- Structured summary of concern, duration, severity, related symptoms, and follow-up
- Safe demo mode when no AI key is available
- Health endpoint for deployment checks: `/api/health`

## Tech stack

- React, TypeScript, and Vite
- Node.js and Express
- OpenAI Chat Completions (optional)
- Browser Web Speech APIs for the demo voice loop

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install
copy .env.example .env
npm run dev
```

Visit `http://localhost:5173`. The Vite dev server forwards `/api` calls to the Node server on port `3001`.

For the adaptive AI experience, add this to `.env`:

```env
OPENAI_API_KEY=your_key_here
```

Without a key, the app remains fully demoable using the local conversation flow and a graceful local report.

## Production build

```bash
npm run build
PORT=3000 npm run start
```

The Express server serves the compiled React app and API from the same origin. This avoids a CORS dependency in the normal deployment path.

## Deploying

The included `Dockerfile` builds and serves the complete app. It can be deployed directly to any Docker-compatible host.

For Render, push this repository to GitHub and create a new Blueprint deployment. Render detects `render.yaml`; add `OPENAI_API_KEY` in the service environment if AI mode is required. The health check is available at `/api/health`.

When deploying the frontend and API separately, set `VITE_API_BASE_URL` during the frontend build to the public API origin. In the standard single-service setup, leave it empty.

## Notes

- Chrome or Edge provides the most consistent microphone recognition support. Users can always type an answer if browser speech recognition is unavailable.
- No call data is persisted by this prototype.
- A production medical product would add authentication, consent, encrypted storage, audit logging, a clinical safety review, and managed STT/TTS services.
