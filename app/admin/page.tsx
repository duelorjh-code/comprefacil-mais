'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, formatBRL } from '@/lib/constants'

interface Metricas {
  pedidos_hoje:             number
  pedidos_andamento:        number
  faturamento_hoje:         number
  receita_app:              number
  faturamento_parceiros:    number
  faturamento_entregadores: number
  parceiros_ativos:         number
  entregadores_online:      number
  alertas_abertos:          number
  pedidos_entregues:        number
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
  const [metricas, setMetricas]         = useState<Metricas | null>(null)
  const [porHora, setPorHora]           = useState<PedidoHora[]>([])
  const [porStatus, setPorStatus]       = useState<Record<string, number>>({})
  const [topParceiros, setTopParceiros] = useState<any[]>([])
  const [topEntregadores, setTopEntregadores] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30_000)
    return () => clearInterval(t)
  }, [])

  async function carregar() {
    // "Hoje" no fuso de Campo Grande (UTC-4)
    const agora    = new Date()
    const tzOffset = -4 * 60 // UTC-4 em minutos
    const local    = new Date(agora.getTime() + (tzOffset - agora.getTimezoneOffset()) * 60000)
    const hoje     = new Date(local)
    hoje.setUTCHours(4, 0, 0, 0) // 00:00 BRT = 04:00 UTC
    const hojeISO  = hoje.toISOString()

    const [
      { count: pedidos_hoje },
      { data: pedidosAtivos },
      { data: faturamento },
      { count: parceiros_ativos },
      { count: entregadores_online },
      { count: alertas_abertos },
      { data: pedidos24h },
      { data: pedidosStatus },
      { data: pedidosParceiros },
      { data: pedidosEntregadores },
    ] = await Promise.all([
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('criado_em', hojeISO),
      supabase.from('pedidos').select('status').not('status', 'in', '(entregue,cancelado,reembolsado)'),
      supabase.from('pedidos').select('total, taxa_conveniencia, valor_produtos, taxa_entrega').eq('status', 'entregue').gte('criado_em', hojeISO),
      supabase.from('parceiros').select('*', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('entregadores').select('*', { count: 'exact', head: true }).eq('status', 'online'),
      supabase.from('alertas_admin').select('*', { count: 'exact', head: true }).eq('resolvido', false),
      supabase.from('pedidos').select('criado_em').gte('criado_em', hojeISO).order('criado_em'),
      supabase.from('pedidos').select('status').not('status', 'in', '(cancelado,reembolsado)'),
      supabase.from('pedidos').select('parceiro_id, valor_produtos, parceiros(nome_fantasia)').eq('status', 'entregue').gte('criado_em', hojeISO),
      supabase.from('pedidos').select('entregador_id, taxa_entrega, entregadores(perfis(nome))').eq('status', 'entregue').gte('criado_em', hojeISO).not('entregador_id', 'is', null),
    ])

    const fat     = (faturamento ?? []).reduce((a: number, p: any) => a + (p.total ?? 0), 0)
    const receita = (faturamento ?? []).reduce((a: number, p: any) => a + (p.taxa_conveniencia ?? 0), 0)
    const fatParc = (faturamento ?? []).reduce((a: number, p: any) => a + (p.valor_produtos ?? 0), 0)
    const fatEnt  = (faturamento ?? []).reduce((a: number, p: any) => a + (p.taxa_entrega ?? 0), 0)
    const entregues = (faturamento ?? []).length

    // Top 5 parceiros
    const mapParc: Record<string, { nome: string; total: number }> = {}
    ;(pedidosParceiros ?? []).forEach((p: any) => {
      const id = p.parceiro_id
      if (!mapParc[id]) mapParc[id] = { nome: p.parceiros?.nome_fantasia ?? '—', total: 0 }
      mapParc[id].total += p.valor_produtos ?? 0
    })
    setTopParceiros(Object.values(mapParc).sort((a, b) => b.total - a.total).slice(0, 5))

    // Top 5 entregadores
    const mapEnt: Record<string, { nome: string; total: number }> = {}
    ;(pedidosEntregadores ?? []).forEach((p: any) => {
      const id = p.entregador_id
      if (!mapEnt[id]) mapEnt[id] = { nome: p.entregadores?.perfis?.nome ?? '—', total: 0 }
      mapEnt[id].total += p.taxa_entrega ?? 0
    })
    setTopEntregadores(Object.values(mapEnt).sort((a, b) => b.total - a.total).slice(0, 5))

    // Por hora
    const horas: Record<string, number> = {}
    for (let h = 0; h < 24; h++) horas[`${h.toString().padStart(2, '0')}h`] = 0
    ;(pedidos24h ?? []).forEach((p: any) => {
      const h = new Date(p.criado_em).getHours()
      horas[`${h.toString().padStart(2, '0')}h`]++
    })
    const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande', hour: 'numeric', hour12: false })
    const agoraH = parseInt(formatter.format(new Date()), 10)
    setPorHora(Object.entries(horas).filter(([k]) => parseInt(k) <= agoraH).slice(-8).map(([hora, total]) => ({ hora, total })))

    // Por status
    const stMap: Record<string, number> = {}
    ;(pedidosStatus ?? []).forEach((p: any) => { stMap[p.status] = (stMap[p.status] ?? 0) + 1 })
    setPorStatus(stMap)

    setMetricas({
      pedidos_hoje:             pedidos_hoje        ?? 0,
      pedidos_andamento:        (pedidosAtivos      ?? []).length,
      faturamento_hoje:         fat,
      receita_app:              receita,
      faturamento_parceiros:    fatParc,
      faturamento_entregadores: fatEnt,
      parceiros_ativos:         parceiros_ativos    ?? 0,
      entregadores_online:      entregadores_online ?? 0,
      alertas_abertos:          alertas_abertos     ?? 0,
      pedidos_entregues:        entregues,
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
    { label: 'Pedidos hoje',        valor: metricas!.pedidos_hoje,          cor: AZUL,      icone: '📦' },
    { label: 'Em andamento',        valor: metricas!.pedidos_andamento,      cor: '#8B5CF6', icone: '⏳' },
    { label: 'Faturamento hoje',    valor: formatBRL(metricas!.faturamento_hoje),    cor: VERDE,     icone: '💰', texto: true },
    { label: 'Financeiro',          valor: null,                             cor: DOURADO,   icone: '💳', financeiro: true },
    { label: 'Parceiros ativos',    valor: metricas!.parceiros_ativos,       cor: '#06B6D4', icone: '🏪' },
    { label: 'Entregadores online', valor: metricas!.entregadores_online,    cor: '#10B981', icone: '🛵' },
    { label: 'Alertas abertos',     valor: metricas!.alertas_abertos,        cor: VERMELHO,  icone: '🔔' },
    { label: 'Entregas concluídas', valor: metricas!.pedidos_entregues,      cor: '#22C55E', icone: '✅' },
  ]

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Dashboard</h1>
          <p style={s.subtitulo}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Campo_Grande' })}</p>
        </div>
        <div style={s.horaAtual}>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande' })}</div>
      </div>

      {/* Cards métricas */}
      <div style={s.cards}>
        {cards.map((c: any, i) => (
          <div key={i} style={{ ...s.card, borderTop: `3px solid ${c.cor}` }}>
            <div style={s.cardIcone}>{c.icone}</div>
            {c.financeiro ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={s.finRow}>
                  <span style={s.finLabel}>Parceiros</span>
                  <span style={{ ...s.finValor, color: AZUL }}>{formatBRL(metricas!.faturamento_parceiros)}</span>
                </div>
                <div style={s.finRow}>
                  <span style={s.finLabel}>Entregadores</span>
                  <span style={{ ...s.finValor, color: VERDE }}>{formatBRL(metricas!.faturamento_entregadores)}</span>
                </div>
                <div style={s.finRow}>
                  <span style={s.finLabel}>App</span>
                  <span style={{ ...s.finValor, color: DOURADO }}>{formatBRL(metricas!.receita_app)}</span>
                </div>
              </div>
            ) : (
              <div style={{ ...s.cardValor, color: c.cor }}>
                {c.texto ? c.valor : Number(c.valor).toLocaleString('pt-BR')}
              </div>
            )}
            <div style={s.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Top 5 + Gráficos */}
      <div style={s.graficos}>

        {/* Top 5 Parceiros */}
        <div style={s.grafico}>
          <h3 style={s.graficoTitulo}>🏪 Top 5 Parceiros — Hoje</h3>
          {topParceiros.length === 0 ? (
            <p style={{ color: TEXTO_MEIO, fontSize: 13 }}>Nenhum dado hoje.</p>
          ) : topParceiros.map((p, i) => (
            <div key={i} style={s.topItem}>
              <span style={s.topPos}>{i + 1}</span>
              <span style={s.topNome}>{p.nome}</span>
              <span style={{ ...s.topValor, color: AZUL }}>{formatBRL(p.total)}</span>
            </div>
          ))}
        </div>

        {/* Top 5 Entregadores */}
        <div style={s.grafico}>
          <h3 style={s.graficoTitulo}>🛵 Top 5 Entregadores — Hoje</h3>
          {topEntregadores.length === 0 ? (
            <p style={{ color: TEXTO_MEIO, fontSize: 13 }}>Nenhum dado hoje.</p>
          ) : topEntregadores.map((e, i) => (
            <div key={i} style={s.topItem}>
              <span style={s.topPos}>{i + 1}</span>
              <span style={s.topNome}>{e.nome}</span>
              <span style={{ ...s.topValor, color: VERDE }}>{formatBRL(e.total)}</span>
            </div>
          ))}
        </div>

        {/* Pedidos por hora */}
        <div style={s.grafico}>
          <h3 style={s.graficoTitulo}>Pedidos por hora (hoje)</h3>
          <div style={s.barras}>
            {porHora.map((h, i) => (
              <div key={i} style={s.barraItem}>
                <div style={s.barraWrap}>
                  <div style={{ ...s.barra, height: `${Math.max(4, (h.total / maxHora) * 100)}%`, background: h.total > 0 ? AZUL : '#E2E8F0' }} />
                </div>
                <span style={s.barraLabel}>{h.hora}</span>
                {h.total > 0 && <span style={s.barraValor}>{h.total}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Por status */}
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
  titulo:        { fontSize: 24, fontWeight: 800, color: '#1A2340', margin: 0 },
  subtitulo:     { fontSize: 13, color: TEXTO_MEIO, marginTop: 2, textTransform: 'capitalize' as const },
  horaAtual:     { fontSize: 20, fontWeight: 700, color: AZUL, background: '#EEF2FF', padding: '6px 14px', borderRadius: 10 },
  cards:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 },
  card:          { background: '#fff', borderRadius: 14, padding: '20px 18px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 6 },
  cardIcone:     { fontSize: 22 },
  cardValor:     { fontSize: 26, fontWeight: 800, lineHeight: 1.1 },
  cardLabel:     { fontSize: 12, color: TEXTO_MEIO, fontWeight: 600 },
  finRow:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  finLabel:      { fontSize: 11, color: TEXTO_MEIO, fontWeight: 600 },
  finValor:      { fontSize: 13, fontWeight: 800 },
  graficos:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grafico:       { background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 10 },
  graficoTitulo: { fontSize: 14, fontWeight: 800, color: '#1A2340', margin: 0 },
  topItem:       { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9' },
  topPos:        { width: 22, height: 22, borderRadius: '50%', background: AZUL, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  topNome:       { flex: 1, fontSize: 13, fontWeight: 600, color: '#1A2340' },
  topValor:      { fontSize: 13, fontWeight: 800 },
  barras:        { display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 },
  barraItem:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' },
  barraWrap:     { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' },
  barra:         { width: '100%', borderRadius: '4px 4px 0 0', minHeight: 4 },
  barraLabel:    { fontSize: 10, color: TEXTO_MEIO, fontWeight: 600 },
  barraValor:    { fontSize: 11, fontWeight: 800, color: AZUL },
  statusLista:   { display: 'flex', flexDirection: 'column', gap: 8 },
  statusItem:    { display: 'flex', alignItems: 'center', gap: 8 },
  statusDot:     { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  statusLabel:   { fontSize: 12, color: TEXTO_MEIO, width: 120, flexShrink: 0 },
  statusBarWrap: { flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  statusBar:     { height: '100%', borderRadius: 3 },
  statusQtd:     { fontSize: 12, fontWeight: 700, color: '#1A2340', width: 20, textAlign: 'right' as const },
}
