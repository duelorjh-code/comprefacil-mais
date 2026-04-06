import { createHmac, timingSafeEqual } from 'crypto'

// Gera token assinado HMAC-SHA256 com expiração de 15 minutos
export function gerarTokenImpersonar(usuario_id: string): string {
  const exp     = Date.now() + 15 * 60 * 1000
  const payload = `${usuario_id}:${exp}`
  const secret  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const sig     = createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

// Valida token — retorna o usuario_id se válido, null se inválido ou expirado
export function validarTokenImpersonar(token: string): string | null {
  try {
    const decoded  = Buffer.from(token, 'base64url').toString('utf8')
    const partes   = decoded.split(':')
    if (partes.length !== 3) return null
    const [usuario_id, expStr, sig] = partes
    const exp      = parseInt(expStr, 10)
    if (Date.now() > exp) return null
    const payload  = `${usuario_id}:${expStr}`
    const secret   = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    const a = Buffer.from(sig,      'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    return usuario_id
  } catch {
    return null
  }
}
