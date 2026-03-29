'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, formatBRL } from '@/lib/constants'

interface Metricas {
  pedidos_hoje:        number
  pedidos_andamento:   number
  faturamento_hoje:    number
  receita_app:         number
  parceiros_ativos:    number
  entregadores_online: number
  alertas_abertos:     number
  pedidos_entregues:   number
  ticket_medio:        number
}

interface PedidoHora { hora: string; total: number }

const STATUS_CONFIG: Record<string, { cor: string; label: string }> = {
  aguardando_pagamento: { cor: '#F59E0B', label: 'Aguardando PIX' },
  pago:                 { cor: '#3B82F6', label: 'Pago'           },
  em_separacao:         { cor: '#8B5CF6', label: 'Em separação'   },
  pronto:               { cor: '#06B6D4', label: 'Pronto'         },
  a_caminho:            { cor: DOURADO,   label: 'A caminho'       },
  entregue:             { cor: VERDE,     label: 'Entregue'        },
  cancelado:            { cor: VERMELHO,  label: 'Cancelado'       },
}

export default function AdminDashboard() {
  const [metricas, setMetricas]   = useState<Metricas | null>(null)
  const [porHora, setPorHora]     = useState<PedidoHora[]>([])
  const [porStatus, setPorStatus] = useState<Record<string, number>>({})
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30_000)
    return () => clearInterval(t)
  }, [])

  async function carregar() {
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const hojeISO = hoje.toISOString()

    const [
      { count: pedidos_hoje },
      { data: pedidosAtivos },
      { data: faturamento },
      { count: parceiros_ativos },
      { count: entregadores_online },
      { count: alertas_abertos },
      { data: pedidos24h },
      { data: pedidosStatus },
    ] = await Promise.all([
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('criado_em', hojeISO),
      supabase.from('pedidos').select('status').not('status', 'in', '(entregue,cancelado,reembolsado)'),
      supabase.from('pedidos').select('total, taxa_conveniencia').eq('status', 'entregue').gte('criado_em', hojeISO),
      supabase.from('parceiros').select('*', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('entregadores').select('*', { count: 'exact', head: true }).eq('status', 'online'),
      supabase.from('alertas_admin').select('*', { count: 'exact', head: true }).eq('resolvido', false),
      supabase.from('pedidos').select('criado_em, status').gte('criado_em', hojeISO).order('criado_em'),
      supabase.from('pedidos').select('status').not('status', 'in', '(cancelado,reembolsado)'),
    ])

    const fat        = (faturamento ?? []).reduce((a: number, p: any) => a + (p.total ?? 0), 0)
    const receita    = (faturamento ?? []).reduce((a: number, p: any) => a + (p.taxa_conveniencia ?? 0), 0)
    const entregues  = (faturamento ?? []).length

    // Agrupar por hora
    const horas: Record<string, number> = {}
    for (let h = 0; h < 24; h++) horas[`${h.toString().padStart(2, '0')}h`] = 0
    ;(pedidos24h ?? []).forEach((p: any) => {
      const h   = new Date(p.criado_em).getHours()
      const key = `${h.toString().padStart(2, '0')}h`
      horas[key] = (horas[key] ?? 0) + 1
    })

    const agoraH     = new Date().getHours()
    const horasExibir = Object.entries(horas)
      .filter(([k]) => parseInt(k) <= agoraH)
      .slice(-8)
      .map(([hora, total]) => ({ hora, total }))
    setPorHora(horasExibir)

    const stMap: Record<string, number> = {}
    ;(pedidosStatus ?? []).forEach((p: any) => { stMap[p.status] = (stMap[p.status] ?? 0) + 1 })
    setPorStatus(stMap)

    setMetricas({
      pedidos_hoje:        pedidos_hoje        ?? 0,
      pedidos_andamento:   (pedidosAtivos      ?? []).length,
      faturamento_hoje:    fat,
      receita_app:         receita,
      parceiros_ativos:    parceiros_ativos    ?? 0,
      entregadores_online: entregadores_online ?? 0,
      alertas_abertos:     alertas_abertos     ?? 0,
      pedidos_entregues:   entregues,
      ticket_medio:        entregues > 0 ? fat / entregues : 0,
    })
    setLoading(false)
  }

  const maxHora = Math.max(...porHora.map(h => h.total), 1)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <span className="anim-spin" style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' }} />
    </div>
  )

  const cards = [
    { label: 'Pedidos hoje',        valor: metricas!.pedidos_hoje,                       cor: AZUL,      icone: '📦' },
    { label: 'Em andamento',        valor: metricas!.pedidos_andamento,                  cor: '#8B5CF6', icone: '⏳' },
    { label: 'Faturamento hoje',    valor: formatBRL(metricas!.faturamento_hoje),        cor: VERDE,     icone: '💰', texto: true },
    { label: 'Receita do App',      valor: formatBRL(metricas!.receita_app),             cor: '#10B981', icone: '📊', texto: true },
    { label: 'Ticket médio',        valor: formatBRL(metricas!.ticket_medio),            cor: DOURADO,   icone: '🎯', texto: true },
    { label: 'Parceiros ativos',    valor: metricas!.parceiros_ativos,                   cor: '#06B6D4', icone: '🏪' },
    { label: 'Entregadores online', valor: metricas!.entregadores_online,                cor: '#10B981', icone: '🛵' },
    { label: 'Alertas abertos',     valor: metricas!.alertas_abertos,                   cor: VERMELHO,  icone: '🔔' },
    { label: 'Entregas concluídas', valor: metricas!.pedidos_entregues,                  cor: '#22C55E', icone: '✅' },
  ]

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Dashboard</h1>
          <p style={s.subtitulo}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        </div>
        <div style={s.horaAtual}>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      <div style={s.cards}>
        {cards.map((c, i) => (
          <div key={i} style={{ ...s.card, borderTop: `3px solid ${c.cor}` }}>
            <div style={s.cardIcone}>{c.icone}</div>
            <div style={{ ...s.cardValor, color: c.cor }}>
              {c.texto ? c.valor : Number(c.valor).toLocaleString('pt-BR')}
            </div>
            <div style={s.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={s.graficos}>
        <div style={s.grafico}>
          <h3 style={s.graficoTitulo}>Pedidos por hora (hoje)</h3>
          <div style={s.barras}>
            {porHora.map((h, i) => (
              <div key={i} style={s.barraItem}>
                <div style={s.barraWrap}>
                  <div style={{
                    ...s.barra,
                    height: `${Math.max(4, (h.total / maxHora) * 100)}%`,
                    background: h.total > 0 ? AZUL : '#E2E8F0',
                  }} />
                </div>
                <span style={s.barraLabel}>{h.hora}</span>
                {h.total > 0 && <span style={s.barraValor}>{h.total}</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={s.grafico}>
          <h3 style={s.graficoTitulo}>Pedidos por status</h3>
          <div style={s.statusLista}>
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
              const qtd   = porStatus[status] ?? 0
              const total = Object.values(porStatus).reduce((a, b) => a + b, 0) || 1
              return (
                <div key={status} style={s.statusItem}>
                  <div style={{ ...s.statusDot, background: cfg.cor }} />
                  <span style={s.statusLabel}>{cfg.label}</span>
                  <div style={s.statusBarWrap}>
                    <div style={{ ...s.statusBar, width: `${(qtd / total) * 100}%`, background: cfg.cor }} />
                  </div>
                  <span style={s.statusQtd}>{qtd}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:          { display: 'flex', flexDirection: 'column', gap: 24 },
  cabecalho:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  titulo:        { fontSize: 24, fontWeight: 800, color: TEXTO },
  subtitulo:     { fontSize: 13, color: TEXTO_MEIO, marginTop: 2, textTransform: 'capitalize' as const },
  horaAtual:     { fontSize: 20, fontWeight: 700, color: AZUL, background: '#EEF2FF', padding: '6px 14px', borderRadius: 10 },
  cards:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 },
  card:          { background: '#fff', borderRadius: 14, padding: '20px 18px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 6 },
  cardIcone:     { fontSize: 22 },
  cardValor:     { fontSize: 26, fontWeight: 800, lineHeight: 1.1 },
  cardLabel:     { fontSize: 12, color: TEXTO_MEIO, fontWeight: 600 },
  graficos:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grafico:       { background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)' },
  graficoTitulo: { fontSize: 14, fontWeight: 800, color: TEXTO, marginBottom: 16 },
  barras:        { display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 },
  barraItem:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' },
  barraWrap:     { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' },
  barra:         { width: '100%', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.3s' },
  barraLabel:    { fontSize: 10, color: TEXTO_MEIO, fontWeight: 600 },
  barraValor:    { fontSize: 11, fontWeight: 800, color: AZUL },
  statusLista:   { display: 'flex', flexDirection: 'column', gap: 10 },
  statusItem:    { display: 'flex', alignItems: 'center', gap: 8 },
  statusDot:     { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  statusLabel:   { fontSize: 12, color: TEXTO_MEIO, width: 120, flexShrink: 0 },
  statusBarWrap: { flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  statusBar:     { height: '100%', borderRadius: 3, transition: 'width 0.3s' },
  statusQtd:     { fontSize: 12, fontWeight: 700, color: TEXTO, width: 20, textAlign: 'right' as const },
}
