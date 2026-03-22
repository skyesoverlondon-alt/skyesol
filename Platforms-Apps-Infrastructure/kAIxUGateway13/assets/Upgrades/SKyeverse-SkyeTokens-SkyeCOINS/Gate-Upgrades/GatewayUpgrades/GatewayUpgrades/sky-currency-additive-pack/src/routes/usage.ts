import { verifyAppToken } from '../auth/verifyAppToken'
import { listKaixuTracesForApp } from '../db/queries'
import type { Env } from '../types'
import { publicUsageEvents } from '../utils/branding'
import { json } from '../utils/json'

export async function handleUsage(request: Request, env: Env): Promise<Response> {
  const auth = await verifyAppToken(request, env)
  const events = await listKaixuTracesForApp(env.DB, auth.appId)
  return json({ ok: true, app_id: auth.appId, events: publicUsageEvents(events) })
}
