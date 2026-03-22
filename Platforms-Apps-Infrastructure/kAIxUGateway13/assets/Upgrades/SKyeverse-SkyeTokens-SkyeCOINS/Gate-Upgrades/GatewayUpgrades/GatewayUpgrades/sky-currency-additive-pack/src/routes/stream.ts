import { assertAliasAllowed } from '../auth/policyGuard'
import { verifyAppToken } from '../auth/verifyAppToken'
import { callOpenAIStream } from '../adapters/openaiStream'
import { insertKaixuTrace } from '../db/queries'
import { isLaneEnabled } from '../env'
import { normalizeAlias, resolveUpstreamTarget } from '../routing/kaixu-engines'
import type { Env, SkyChatRequest } from '../types'
import { publicEngineName } from '../utils/branding'
import { KaixuError, toHttpError } from '../utils/errors'
import { json, readJson, sse } from '../utils/json'
import { estimateSize } from '../utils/openai-response'
import { parseSse, encodeSse } from '../utils/sse'
import { createTraceId } from '../utils/trace'

function extractDelta(payload: any): string {
  if (typeof payload?.delta === 'string') return payload.delta
  if (typeof payload?.text === 'string') return payload.text
  if (typeof payload?.output_text === 'string') return payload.output_text
  return ''
}

export async function handleStream(request: Request, env: Env): Promise<Response> {
  const traceId = createTraceId()
  const started = Date.now()
  const auth = await verifyAppToken(request, env)
  const body = await readJson<SkyChatRequest>(request)
  const alias = normalizeAlias(body.engine || body.alias, 'chat')
  assertAliasAllowed(auth, alias)

  if (!isLaneEnabled(env, 'stream')) {
    const err = new KaixuError(503, 'KAIXU_LANE_DISABLED', 'This Kaixu lane is disabled or not configured.')
    return json({ ok: false, trace_id: traceId, error: { code: err.code, message: err.message } }, err.status)
  }

  const upstream = await resolveUpstreamTarget(alias, env)

  try {
    const upstreamResponse = await callOpenAIStream(upstream.model, { ...body, alias, stream: true }, env, alias)
    let outputChars = 0
    let usage: Record<string, unknown> = {}
    let finished = false

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encodeSse('meta', { trace_id: traceId, engine: publicEngineName(alias), ok: true }))
        try {
          for await (const event of parseSse(upstreamResponse.body!)) {
            if (event.data === '[DONE]') break
            let payload: any = null
            try {
              payload = event.data ? JSON.parse(event.data) : null
            } catch {
              payload = { raw: event.data }
            }

            const eventType = String(payload?.type || event.event)
            if (eventType.includes('error')) {
              controller.enqueue(encodeSse('error', { code: 'KAIXU_ENGINE_UNAVAILABLE', message: 'The requested Kaixu engine is unavailable right now.' }))
              continue
            }

            if (eventType.includes('delta')) {
              const delta = extractDelta(payload)
              if (delta) {
                outputChars += delta.length
                controller.enqueue(encodeSse('delta', { text: delta }))
              }
              continue
            }

            if (eventType.includes('completed') || eventType.includes('done')) {
              usage = payload?.response?.usage || payload?.usage || {}
              controller.enqueue(encodeSse('done', { usage }))
              finished = true
            }
          }

          if (!finished) controller.enqueue(encodeSse('done', { usage }))
          await insertKaixuTrace(env.DB, {
            traceId,
            appId: auth.appId,
            userId: body.metadata?.user_id,
            orgId: auth.orgId,
            lane: 'stream',
            engineAlias: alias,
            publicStatus: 'success',
            upstreamVendor: upstream.provider,
            upstreamModel: upstream.model,
            inputSizeEstimate: estimateSize(body),
            outputSizeEstimate: outputChars,
            usageJson: usage,
            latencyMs: Date.now() - started,
            publicResponseJson: { ok: true, trace_id: traceId, engine: publicEngineName(alias) },
            requestMethod: request.method,
            requestPath: new URL(request.url).pathname,
          })
        } catch (error) {
          const httpError = toHttpError(error)
          controller.enqueue(encodeSse('error', { code: httpError.code, message: httpError.message }))
          await insertKaixuTrace(env.DB, {
            traceId,
            appId: auth.appId,
            userId: body.metadata?.user_id,
            orgId: auth.orgId,
            lane: 'stream',
            engineAlias: alias,
            publicStatus: 'error',
            upstreamVendor: upstream.provider,
            upstreamModel: upstream.model,
            inputSizeEstimate: estimateSize(body),
            latencyMs: Date.now() - started,
            publicErrorCode: httpError.code,
            publicErrorMessage: httpError.message,
            requestMethod: request.method,
            requestPath: new URL(request.url).pathname,
            internalErrorJson: { adminDetail: httpError.adminDetail, raw: httpError.raw },
          })
        } finally {
          controller.close()
        }
      },
    })

    return sse(stream)
  } catch (error) {
    const httpError = toHttpError(error)
    await insertKaixuTrace(env.DB, {
      traceId,
      appId: auth.appId,
      userId: body.metadata?.user_id,
      orgId: auth.orgId,
      lane: 'stream',
      engineAlias: alias,
      publicStatus: 'error',
      upstreamVendor: upstream.provider,
      upstreamModel: upstream.model,
      inputSizeEstimate: estimateSize(body),
      latencyMs: Date.now() - started,
      publicErrorCode: httpError.code,
      publicErrorMessage: httpError.message,
      requestMethod: request.method,
      requestPath: new URL(request.url).pathname,
      internalErrorJson: { adminDetail: httpError.adminDetail, raw: httpError.raw },
    })
    return json({ ok: false, trace_id: traceId, error: { code: httpError.code, message: httpError.message } }, httpError.status)
  }
}
