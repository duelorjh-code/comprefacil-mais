'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const STATUS: Record<string, { cor: string; label: string }> = {
  aguardando_pagamento: { cor: '#F59E0B', label: 'Aguardando PIX' },
  pago:                 { cor: '#3B82F6', label: 'Pago'           },
  em_separacao:         { cor: '#8B5CF6', label: 'Separando'      },
  pronto:               { cor: '#06B6D4', label: 'Pronto'         },
  a_caminho:            { cor: DOURADO,   label: 'A caminho'       },
  entregue:             { cor: VERDE,     label: 'Entregue'        },
  cancelado:            { cor: VERMELHO,  label: 'Cancelado'       },
  reembolsado:          { cor: '#6B7280', label: 'Reembolsado'    },
}

function slaColor(pedido: any): string {
  if (['entregue','cancelado','reembolsado'].includes(pedido.status)) return VERDE
  if (!pedido.tempo_limite) return TEXTO_MEIO
  const restante = new Date(pedido.tempo_limite).getTime() - Date.now()
  const pct = restante / (pedido.sla_minutos * 60_000)
  if (pct > 0.5)  return VERDE
  if (pct > 0.2)  return LARANJA
  if (pct > 0)    return VERMELHO
  return VERMELHO
}

function slaLabel(pedido: any): string {
  if (['entregue','cancelado','reembolsado'].includes(pedido.status)) return '✓'
  if (!pedido.tempo_limite) return '–'
  const ms = new Date(pedido.tempo_limite).getTime() - Date.now()
  if (ms <= 0) return 'VENCIDO'
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}:${s.toString().padStart(2,'0')}`
}

export default function AdminPedidos() {
  const [pedidos, setPedidos]   = useState<any[]>([])
  const [filtro, setFiltro]     = useState('todos')
  const [busca, setBusca]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [tick, setTick]         = useState(0)

  useEffect(() => {
    carregar()
    const canal = supabase.channel('admin-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, carregar)
      .subscribe()
    const timer = setInterval(() => setTick(v => v + 1), 1000)
    return () => { supabase.removeChannel(canal); clearInterval(timer) }
  }, [])

  async function carregar() {
    const q = supabase.from('pedidos')
      .select(`
        id, status, total, valor_produtos, taxa_entrega, taxa_conveniencia,
        distancia_km, sla_minutos, tempo_limite, criado_em, observacoes,
        codigo_confirmacao, endereco_entrega,
        clientes ( perfis ( nome, telefone ) ),
        parceiros ( nome_fantasia ),
        entregadores ( perfis ( nome ) )
      `)
      .order('criado_em', { ascending: false })
      .limit(100)

    const { data } = await q
    setPedidos(data ?? [])
    setLoading(false)
  }

  async function atualizarStatus(id: string, status: string) {
    await supabase.from('pedidos').update({ status }).eq('id', id)
  }

  const filtrados = pedidos.filter(p => {
    if (filtro !== 'todos' && p.status !== filtro) return false
    if (busca) {
      const b = busca.toLowerCase()
      return p.id.includes(b) ||
        (p.clientes?.perfis?.nome ?? '').toLowerCase().includes(b) ||
        (p.parceiros?.nome_fantasia ?? '').toLowerCase().includes(b)
    }
    return true
  })

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Pedidos</h1>
        <span style={s.badge}>{pedidos.filter(p => !['entregue','cancelado','reembolsado'].includes(p.status)).length} ativos</span>
      </div>

      {/* Filtros */}
      <div style={s.filtros}>
        <input style={s.busca} placeholder="🔍  Buscar por ID, cliente ou parceiro…"
          value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={s.tabs}>
          {['todos', ...Object.keys(STATUS)].map(st => (
            <button key={st} onClick={() => setFiltro(st)}
              style={{ ...s.tab, ...(filtro===st ? s.tabAtivo : {}) }}>
              {st === 'todos' ? 'Todos' : STATUS[st]?.label ?? st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : filtrados.length === 0 ? (
        <div style={s.vazio}>Nenhum pedido encontrado.</div>
      ) : (
        <div style={s.lista}>
          {filtrados.map(p => {
            const sla = slaLabel(p)
            const cor = slaColor(p)
            const st  = STATUS[p.status] ?? { cor: '#999', label: p.status }
            return (
              <div key={p.id} style={s.card}>
                <div style={s.cardTop}>
                  <div style={s.cardId}>#{p.id.slice(0,8).toUpperCase()}</div>
                  <span style={{ ...s.statusPill, background: st.cor + '20', color: st.cor }}>
                    {st.label}
                  </span>
                  <div style={{ ...s.slaTimer, color: cor, borderColor: cor + '40' }}>
                    ⏱ {sla}
                  </div>
                </div>

                <div style={s.cardInfo}>
                  <div style={s.infoItem}>
                    <span style={s.infoLabel}>Cliente</span>
                    <span style={s.infoValor}>{p.clientes?.perfis?.nome ?? '–'}</span>
                  </div>
                  <div style={s.infoItem}>
                    <span style={s.infoLabel}>Parceiro</span>
                    <span style={s.infoValor}>{p.parceiros?.nome_fantasia ?? '–'}</span>
                  </div>
                  <div style={s.infoItem}>
                    <span style={s.infoLabel}>Entregador</span>
                    <span style={s.infoValor}>{p.entregadores?.perfis?.nome ?? '–'}</span>
                  </div>
                  <div style={s.infoItem}>
                    <span style={s.infoLabel}>Total</span>
                    <span style={{ ...s.infoValor, fontWeight: 800, color: AZUL }}>{formatBRL(p.total)}</span>
                  </div>
                  <div style={s.infoItem}>
                    <span style={s.infoLabel}>Distância</span>
                    <span style={s.infoValor}>{p.distancia_km ? `${p.distancia_km}km` : '–'}</span>
                  </div>
                  <div style={s.infoItem}>
                    <span style={s.infoLabel}>Código</span>
                    <span style={{ ...s.infoValor, fontWeight: 800, letterSpacing: 2 }}>{p.codigo_confirmacao}</span>
                  </div>
                </div>

                {p.endereco_entrega && (
                  <div style={s.endereco}>📍 {p.endereco_entrega}</div>
                )}

                {/* Ações rápidas */}
                {!['entregue','cancelado','reembolsado'].includes(p.status) && (
                  <div style={s.acoes}>
                    {p.status === 'aguardando_pagamento' && (
                      <button onClick={() => atualizarStatus(p.id,'pago')} style={{ ...s.btnAcao, background: '#3B82F620', color:'#3B82F6' }}>
                        ✓ Marcar pago
                      </button>
                    )}
                    <button onClick={() => atualizarStatus(p.id,'cancelado')} style={{ ...s.btnAcao, background: '#EF444420', color: VERMELHO }}>
                      ✕ Cancelar
                    </button>
                    <button onClick={() => atualizarStatus(p.id,'reembolsado')} style={{ ...s.btnAcao, background: '#6B728020', color:'#6B7280' }}>
                      ↩ Reembolsar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:   { display: 'flex', flexDirection: 'column', gap: 20 },
  cabecalho: { display: 'flex', alignItems: 'center', gap: 12 },
  titulo: { fontSize: 22, fontWeight: 800, color: TEXTO },
  badge:  { background: '#EF444420', color: VERMELHO, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  filtros: { display: 'flex', flexDirection: 'column', gap: 12 },
  busca: { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: TEXTO, background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  tab: { padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${CINZA_BORDA}`, background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: TEXTO_MEIO, fontFamily: 'inherit', transition: 'all 0.15s' },
  tabAtivo: { background: AZUL, color: '#fff', borderColor: AZUL },
  loading: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: { width: 32, height: 32, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  vazio:  { textAlign: 'center' as const, padding: 60, color: TEXTO_MEIO, fontSize: 14 },
  lista:  { display: 'flex', flexDirection: 'column', gap: 12 },
  card:   { background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const },
  cardId: { fontWeight: 800, fontSize: 13, color: AZUL, fontFamily: 'monospace' },
  statusPill: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  slaTimer: { fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20, border: '1.5px solid', marginLeft: 'auto' },
  cardInfo: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px' },
  infoItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  infoLabel: { fontSize: 10, color: TEXTO_MEIO, fontWeight: 600, textTransform: 'uppercase' as const },
  infoValor: { fontSize: 13, color: TEXTO, fontWeight: 600 },
  endereco: { fontSize: 12, color: TEXTO_MEIO, background: '#F4F6FB', borderRadius: 8, padding: '8px 10px' },
  acoes:  { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  btnAcao: { padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
}
