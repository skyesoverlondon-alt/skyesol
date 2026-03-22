import { requireDb } from '../env'
import { findAppTokenByHash } from '../db/queries'
import type { AuthContext, Env } from '../types'
import { KaixuError } from '../utils/errors'
import { sha256Hex } from '../utils/hashing'

function readBearerToken(request: Request): string {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    throw new KaixuError(401, 'KAIXU_UNAUTHORIZED', 'This Kaixu route is not authorized for the current caller.', { adminDetail: 'Missing Bearer token.' })
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw new KaixuError(401, 'KAIXU_UNAUTHORIZED', 'This Kaixu route is not authorized for the current caller.', { adminDetail: 'Empty Bearer token.' })
  }
  return token
}

export async function verifyAppToken(request: Request, env: Env): Promise<AuthContext> {
  const token = readBearerToken(request)
  const tokenHash = await sha256Hex(token)
  const auth = await findAppTokenByHash(requireDb(env), tokenHash)

  if (!auth) {
    throw new KaixuError(401, 'KAIXU_UNAUTHORIZED', 'This Kaixu route is not authorized for the current caller.', { adminDetail: 'App token not recognized.' })
  }

  return auth
}
