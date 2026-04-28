// ── Paleta de cores ────────────────────────────────────────────
export const AZUL       = '#1B2F5E'   // Azul marinho principal
export const AZUL_MEIO  = '#243d78'   // Azul médio (hover)
export const AZUL_CLARO = '#EEF2FF'   // Fundo azul suave
export const DOURADO    = '#D4A017'   // Dourado principal
export const DOURADO_CLARO = '#FDF3D8' // Fundo dourado suave
export const CINZA      = '#F4F6FB'   // Fundo geral
export const CINZA_BORDA= '#E2E8F0'   // Bordas
export const TEXTO      = '#1A2340'   // Texto principal
export const TEXTO_MEIO = '#4A5568'   // Texto secundário
export const TEXTO_SUAVE= '#8A95A5'   // Texto terciário
export const VERDE      = '#22C55E'   // Sucesso
export const VERMELHO   = '#EF4444'   // Erro
export const LARANJA    = '#F97316'   // Alerta

// ── Número do Admin (WhatsApp) ─────────────────────────────────
export const WHATS_ADMIN = process.env.NEXT_PUBLIC_WHATS_ADMIN ?? '5567900000000'
export function linkWhats(msg = 'Olá, preciso de ajuda.') {
  return `https://wa.me/${WHATS_ADMIN}?text=${encodeURIComponent(msg)}`
}

// ── Regras de negócio ─────────────────────────────────────────
export const CARRINHO_MINIMO = 30

export function calcTaxaEntrega(km: number): number {
  if (km <= 6)  return 6.00
  if (km <= 10) return 8.50
  return parseFloat((6.00 + (km - 6) * 0.50).toFixed(2))
}

export function calcSlaMinutos(km: number): number {
  if (km <= 6)  return 40
  if (km <= 10) return 55
  if (km <= 15) return 70
  if (km <= 20) return 85
  return 100
}

export function calcConveniencia(valor: number): number {
  if (valor < 60)  return 5.00
  if (valor < 120) return 7.00
  if (valor < 240) return 9.00
  if (valor < 480) return 11.00
  return 13.00
}

export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R   = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a   = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2))
}

export function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatTelefone(v: string) {
  const n = v.replace(/\D/g,'').slice(0,11)
  if (n.length <= 2)  return n
  if (n.length <= 7)  return `(${n.slice(0,2)}) ${n.slice(2)}`
  return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
}

export const RODAPE = `© ${new Date().getFullYear()} CompreFácil+ · Sua conveniência à um clique de distância.`
