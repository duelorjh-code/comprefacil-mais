'use client'

import { useState, useEffect, useRef } from 'react'
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

function slaLabel(p: any): string {
  if (['entregue','cancelado','reembolsado'].includes(p.status)) return '✓'
  if (!p.tempo_limite) return '–'
  const ms = new Date(p.tempo_limite).getTime() - Date.now()
  if (ms <= 0) return 'VENCIDO'
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}:${s.toString().padStart(2,'0')}`
}

function slaColor(p: any): string {
  if (['entregue','cancelado','reembolsado'].includes(p.status)) return VERDE
  if (!p.tempo_limite) return TEXTO_MEIO
  const ms = new Date(p.tempo_limite).getTime() - Date.now()
  if (ms <= 0) return VERMELHO
  if (ms < 10 * 60_000) return VERMELHO
  if (ms < 20 * 60_000) return LARANJA
  return VERDE
}

export default function AdminPedidos() {
  const [pedidos, setPedidos]     = useState<any[]>([])
  const [filtro, setFiltro]       = useState('todos')
  const [busca, setBusca]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [tick, setTick]           = useState(0)
  const audioRef                  = useRef<HTMLAudioElement | null>(null)
  const prevIds                   = useRef<Set<string>>(new Set())

  useEffect(() => {
    carregar()
    const canal = supabase.channel('admin-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, carregar)
      .subscribe()
    const timer = setInterval(() => setTick(v => v + 1), 1000)
    return () => { supabase.removeChannel(canal); clearInterval(timer) }
  }, [])

  async function carregar() {
    const { data } = await supabase.from('pedidos')
      .select(`
        id, status, total, valor_produtos, taxa_entrega, taxa_conveniencia,
        distancia_km, sla_minutos, tempo_limite, criado_em,
        codigo_confirmacao, endereco_entrega,
        clientes ( perfis ( nome, telefone ) ),
        parceiros ( nome_fantasia ),
        entregadores ( perfis ( nome ) ),
        pedido_itens ( quantidade, preco_unitario, produtos ( nome, imagem_url ) )
      `)
      .order('criado_em', { ascending: false })
      .limit(100)

    if (data) {
      const novos = data.filter((p: any) => !prevIds.current.has(p.id) && p.status === 'aguardando_pagamento')
      if (novos.length > 0) audioRef.current?.play().catch(() => {})
      prevIds.current = new Set(data.map((p: any) => p.id))
      setPedidos(data)
    }
    setLoading(false)
  }

  async function atualizarStatus(id: string, status: string) {
    setAtualizando(id + status)
    const { error } = await supabase.from('pedidos').update({ status }).eq('id', id)
    if (error) {
      alert('Erro ao atualizar: ' + error.message)
    }
    await carregar()
    setAtualizando(null)
  }

  const filtrados = pedidos.filter(p => {
    if (filtro !== 'todos' && p.status !== filtro) return false
    if (busca) {
      const b = busca.toLowerCase()
      return p.id.toLowerCase().includes(b) ||
        (p.clientes?.perfis?.nome ?? '').toLowerCase().includes(b) ||
        (p.parceiros?.nome_fantasia ?? '').toLowerCase().includes(b)
    }
    return true
  })

  return (
    <div style={s.wrap}>
      <audio ref={audioRef} src="/sons/alerta.mp3" preload="auto" />

      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Pedidos</h1>
        <span style={s.badge}>
          {pedidos.filter(p => !['entregue','cancelado','reembolsado'].includes(p.status)).length} ativos
        </span>
      </div>

      <div style={s.filtros}>
        <input style={s.busca} placeholder="🔍 Buscar por ID, cliente ou parceiro…"
          value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={s.tabs}>
          {['todos', ...Object.keys(STATUS)].map(st => (
            <button key={st} onClick={() => setFiltro(st)}
              style={{ ...s.tab, ...(filtro === st ? s.tabAtivo : {}) }}>
              {st === 'todos' ? 'Todos' : STATUS[st]?.label ?? st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={s.vazio}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={s.vazio}>Nenhum pedido encontrado.</div>
      ) : (
        <div style={s.lista}>
          {filtrados.map(p => {
            const st  = STATUS[p.status] ?? { cor: '#999', label: p.status }
            const sla = slaLabel(p)
            const cor = slaColor(p)
            return (
              <div key={p.id} style={s.card}>

                {/* Topo */}
                <div style={s.cardTop}>
                  <span style={s.cardId}>#{p.id.slice(0,8).toUpperCase()}</span>
                  <span style={{ ...s.pill, background: st.cor + '20', color: st.cor }}>
                    {st.label}
                  </span>
                  <span style={{ ...s.slaTimer, color: cor }}>⏱ {sla}</span>
                </div>

                {/* Info */}
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

                {/* Ações */}
                {!['entregue','cancelado','reembolsado'].includes(p.status) && (
                  <div style={s.acoes}>
                    {p.status === 'aguardando_pagamento' && (
                      <BtnAcao
                        label="✓ Marcar pago"
                        cor="#3B82F6"
                        loading={atualizando === p.id + 'pago'}
                        onClick={() => atualizarStatus(p.id, 'pago')}
                      />
                    )}
                    {p.status === 'pago' && (
                      <BtnAcao
                        label="📦 Iniciar separação"
                        cor="#8B5CF6"
                        loading={atualizando === p.id + 'em_separacao'}
                        onClick={() => atualizarStatus(p.id, 'em_separacao')}
                      />
                    )}
                    {p.status === 'em_separacao' && (
                      <BtnAcao
                        label="✓ Marcar pronto"
                        cor={DOURADO}
                        loading={atualizando === p.id + 'pronto'}
                        onClick={() => atualizarStatus(p.id, 'pronto')}
                      />
                    )}
                    <BtnAcao
                      label="✕ Cancelar"
                      cor={VERMELHO}
                      loading={atualizando === p.id + 'cancelado'}
                      onClick={() => atualizarStatus(p.id, 'cancelado')}
                    />
                    <BtnAcao
                      label="↩ Reembolsar"
                      cor="#6B7280"
                      loading={atualizando === p.id + 'reembolsado'}
                      onClick={() => atualizarStatus(p.id, 'reembolsado')}
                    />
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

function BtnAcao({ label, cor, onClick, loading }: {
  label: string; cor: string; onClick: () => void; loading: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '8px 14px',
        background: loading ? cor + '10' : cor + '18',
        border: `1.5px solid ${cor}`,
        borderRadius: 8,
        color: loading ? cor + '80' : cor,
        fontSize: 12,
        fontWeight: 800,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? '...' : label}
    </button>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:      { display: 'flex', flexDirection: 'column', gap: 20 },
  cabecalho: { display: 'flex', alignItems: 'center', gap: 12 },
  titulo:    { fontSize: 22, fontWeight: 800, color: TEXTO, margin: 0 },
  badge:     { background: '#EF444420', color: VERMELHO, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  filtros:   { display: 'flex', flexDirection: 'column', gap: 12 },
  busca:     { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: TEXTO, background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' },
  tabs:      { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  tab:       { padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${CINZA_BORDA}`, background: '#fff', fontSize: 12, fontWeight: 700, color: TEXTO_MEIO, cursor: 'pointer', fontFamily: 'inherit' },
  tabAtivo:  { background: AZUL, color: '#fff', borderColor: AZUL },
  lista:     { display: 'flex', flexDirection: 'column', gap: 12 },
  vazio:     { textAlign: 'center' as const, padding: 40, color: TEXTO_MEIO },
  card:      { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 8px rgba(27,47,94,0.08)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop:   { display: 'flex', alignItems: 'center', gap: 10 },
  cardId:    { fontSize: 13, fontWeight: 800, color: TEXTO, letterSpacing: 1 },
  pill:      { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  slaTimer:  { fontSize: 12, fontWeight: 700, marginLeft: 'auto' },
  cardInfo:  { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  infoItem:  { display: 'flex', flexDirection: 'column', gap: 2 },
  infoLabel: { fontSize: 10, fontWeight: 700, color: TEXTO_MEIO, textTransform: 'uppercase' as const },
  infoValor: { fontSize: 13, fontWeight: 600, color: TEXTO },
  endereco:  { fontSize: 12, color: TEXTO_MEIO, background: '#F4F6FB', borderRadius: 8, padding: '8px 12px' },
  acoes:     { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
}
