# Frontend Integration Map

Every app surface should call Kaixu routes only.

## Call map

- Standard prompt/response UI → `POST /v1/chat`
- SSE text UI → `POST /v1/stream`
- Image generation / edit UI → `POST /v1/images`
- Video generation UI → `POST /v1/videos`, then poll `GET /v1/videos/:job_id`
- Speech synthesis UI → `POST /v1/audio/speech`
- Audio upload transcription UI → `POST /v1/audio/transcriptions`
- Browser realtime client bootstrap → `POST /v1/realtime/session`
- Usage dashboard → `GET /v1/usage`
- Generic job polling panel → `GET /v1/jobs/:job_id`

## Frontend rules

- Never call OpenAI directly.
- Never assume `/v1/chat` or `/v1/stream` can impersonate image/video/audio lanes.
- Treat `trace_id` and `job_id` as the source of truth.
- Poll Kaixu job routes for async lanes.
- Queue artifact export / PDF / ZIP work separately from hot inference routes.
