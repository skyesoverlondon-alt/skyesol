import { insertFallbackLog } from '../db/queries'
import { requireDb } from '../env'
import { callAnthropicChat } from '../providers/anthropic'
import { callGeminiChat } from '../providers/gemini'
import { callOpenAIChat } from '../providers/openai'
import type { Env, NormalizedProviderTextResponse, RouteOption, SkyChatRequest } from '../types'

async function invokeChatRoute(route: RouteOption, request: SkyChatRequest, env: Env): Promise<NormalizedProviderTextResponse> {
  switch (route.provider) {
    case 'openai':
      return await callOpenAIChat(route.model, request, env)
    case 'gemini':
      return await callGeminiChat(route.model, request, env)
    case 'anthropic':
      return await callAnthropicChat(route.model, request, env)
  }
}

export async function executeChatWithFallback(params: {
  traceId: string
  primary: RouteOption
  fallbacks: RouteOption[]
  allowFallback: boolean
  request: SkyChatRequest
  env: Env
}): Promise<{ route: RouteOption; result: NormalizedProviderTextResponse }> {
  const { traceId, primary, fallbacks, allowFallback, request, env } = params

  try {
    const result = await invokeChatRoute(primary, request, env)
    return { route: primary, result }
  } catch (primaryError) {
    if (!allowFallback || fallbacks.length === 0) {
      throw primaryError
    }

    let previous = primary
    let lastError: unknown = primaryError

    for (const fallback of fallbacks) {
      try {
        const result = await invokeChatRoute(fallback, request, env)
        await insertFallbackLog(requireDb(env), {
          traceId,
          fromProvider: previous.provider,
          fromModel: previous.model,
          toProvider: fallback.provider,
          toModel: fallback.model,
          reason: lastError instanceof Error ? lastError.message : 'Primary route failed.',
        })
        return { route: fallback, result }
      } catch (fallbackError) {
        await insertFallbackLog(requireDb(env), {
          traceId,
          fromProvider: previous.provider,
          fromModel: previous.model,
          toProvider: fallback.provider,
          toModel: fallback.model,
          reason: fallbackError instanceof Error ? fallbackError.message : 'Fallback route failed.',
        })
        previous = fallback
        lastError = fallbackError
      }
    }

    throw lastError
  }
}
