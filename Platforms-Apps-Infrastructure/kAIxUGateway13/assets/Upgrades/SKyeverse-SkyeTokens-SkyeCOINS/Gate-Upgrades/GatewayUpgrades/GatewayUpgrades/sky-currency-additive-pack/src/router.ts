import type { Env } from './types'
import { json } from './utils/json'
import { toHttpError } from './utils/errors'
import { handleHealth } from './routes/health'
import { handleModels } from './routes/models'
import { handleChat } from './routes/chat'
import { handleStream } from './routes/stream'
import { handleCreateImage, handleGetImageJob } from './routes/images'
import { handleCreateVideo, handleGetVideoJob } from './routes/videos'
import { handleAudioSpeech } from './routes/audio-speech'
import { handleAudioTranscriptions } from './routes/audio-transcriptions'
import { handleRealtimeSession } from './routes/realtime-session'
import { handleUsage } from './routes/usage'
import { handleGetJob } from './routes/jobs'
import { handleAdminTrace } from './routes/admin-traces'
import { handleAdminJob } from './routes/admin-jobs'
import { handleAdminUpstream } from './routes/admin-upstream'
import { handleAdminRetryJob, handleAdminCancelJob } from './routes/admin-job-actions'

export async function routeRequest(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method.toUpperCase()

    if (path === '/v1/health' && method === 'GET') return await handleHealth(request, env)
    if (path === '/v1/models' && method === 'GET') return await handleModels(request, env)
    if (path === '/v1/chat' && method === 'POST') return await handleChat(request, env)
    if (path === '/v1/stream' && method === 'POST') return await handleStream(request, env)
    if (path === '/v1/images' && method === 'POST') return await handleCreateImage(request, env)
    if (path === '/v1/videos' && method === 'POST') return await handleCreateVideo(request, env)
    if (path === '/v1/audio/speech' && method === 'POST') return await handleAudioSpeech(request, env)
    if (path === '/v1/audio/transcriptions' && method === 'POST') return await handleAudioTranscriptions(request, env)
    if (path === '/v1/realtime/session' && method === 'POST') return await handleRealtimeSession(request, env)
    if (path === '/v1/usage' && method === 'GET') return await handleUsage(request, env)

    const imageMatch = /^\/v1\/images\/([^/]+)$/.exec(path)
    if (imageMatch && method === 'GET') return await handleGetImageJob(request, env, imageMatch[1])

    const videoMatch = /^\/v1\/videos\/([^/]+)$/.exec(path)
    if (videoMatch && method === 'GET') return await handleGetVideoJob(request, env, videoMatch[1])

    const jobMatch = /^\/v1\/jobs\/([^/]+)$/.exec(path)
    if (jobMatch && method === 'GET') return await handleGetJob(request, env, jobMatch[1])

    const adminTraceMatch = /^\/admin\/traces\/([^/]+)$/.exec(path)
    if (adminTraceMatch && method === 'GET') return await handleAdminTrace(request, env, adminTraceMatch[1])

    const adminJobMatch = /^\/admin\/jobs\/([^/]+)$/.exec(path)
    if (adminJobMatch && method === 'GET') return await handleAdminJob(request, env, adminJobMatch[1])

    const adminUpstreamMatch = /^\/admin\/upstream\/([^/]+)$/.exec(path)
    if (adminUpstreamMatch && method === 'GET') return await handleAdminUpstream(request, env, adminUpstreamMatch[1])

    const adminRetryMatch = /^\/admin\/retry\/([^/]+)$/.exec(path)
    if (adminRetryMatch && method === 'POST') return await handleAdminRetryJob(request, env, adminRetryMatch[1])

    const adminCancelMatch = /^\/admin\/cancel\/([^/]+)$/.exec(path)
    if (adminCancelMatch && method === 'POST') return await handleAdminCancelJob(request, env, adminCancelMatch[1])

    return json({ ok: false, error: { code: 'NOT_FOUND', message: `No route for ${method} ${path}` } }, 404)
  } catch (error) {
    const httpError = toHttpError(error)
    return json({ ok: false, error: { code: httpError.code, message: httpError.message } }, httpError.status)
  }
}
