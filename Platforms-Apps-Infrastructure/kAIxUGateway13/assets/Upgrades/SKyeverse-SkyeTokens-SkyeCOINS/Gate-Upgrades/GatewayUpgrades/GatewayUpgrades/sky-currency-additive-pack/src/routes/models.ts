import { verifyAppToken } from '../auth/verifyAppToken'
import type { Env } from '../types'
import { PUBLIC_ALIASES, publicModelDescriptors } from '../utils/branding'
import { json } from '../utils/json'

export async function handleModels(request: Request, env: Env): Promise<Response> {
  const auth = await verifyAppToken(request, env)
  const allowed = auth.allowedAliases.length > 0 ? PUBLIC_ALIASES.filter((alias) => auth.allowedAliases.includes(alias)) : PUBLIC_ALIASES
  return json({
    ok: true,
    app_id: auth.appId,
    aliases: publicModelDescriptors(allowed.map((alias) => ({ alias }))),
  })
}
