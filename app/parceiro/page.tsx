'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const STATUS: Record<string, { cor: string; label: string; bg: string }> = {
  pago:         { cor: '#1D4ED8', bg: '#DBEAFE', label: 'Pago'        },
  em_separacao: { cor: '#6D28D9', bg: '#EDE9FE', label: 'Separando'   },
  pronto:       { cor: '#0E7490', bg: '#CFFAFE', label: 'Pronto'      },
  a_caminho:    { cor: '#92400E', bg: '#FEF3C7', label: 'A caminho'   },
  entregue:     { cor: '#065F46', bg: '#D1FAE5', label: 'Entregue'    },
  cancelado:    { cor: '#991B1B', bg: '#FEE2E2', label: 'Cancelado'   },
}

export default function ParceiroPedidos() {
  const [parcId, setParcId]           = useState('')
  const [pedidos, setPedidos]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [avancando, setAvancando]     = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [filtro, setFiltro]           = useState('todos')
  const [busca, setBusca]             = useState('')
  const [erro, setErro]               = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    let canal: any = null

    async function init() {
      const token = sessionStorage.getItem('parceiro_impersonar')
      let pid = ''

      if (token) {
        const res  = await fetch(`/api/admin/parceiro-id?token=${encodeURIComponent(token)}`)
        const json = await res.json()
        if (res.ok && json.parceiro_id) {
          pid = json.parceiro_id
        } else {
          sessionStorage.removeItem('parceiro_impersonar')
        }
      }

      if (!pid) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase
          .from('parceiros').select('id').eq('usuario_id', user.id).single()
        if (!p) return
        pid = p.id
      }

      setParcId(pid)
      await carregar(pid)

      canal = supabase.channel('parceiro-pedidos-' + pid)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'pedidos',
          filter: `parceiro_id=eq.${pid}`,
        }, () => {
          carregar(pid)
          try { audioRef.current?.play().catch(() => {}) } catch {}
        })
        .subscribe()
    }

    init()
    return () => { if (canal) supabase.removeChannel(canal) }
  }, [])

  async function carregar(pid: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id, status, total, criado_em, endereco_entrega, codigo_confirmacao,
        pedido_itens ( quantidade, preco_unitario, produtos ( nome ) ),
        clientes ( perfis ( nome, telefone ) ),
        entregadores ( perfis ( nome, telefone ) )
      `)
      .eq('parceiro_id', pid)
      .not('status', 'in', '(entregue,cancelado,reembolsado)')
      .order('criado_em', { ascending: true })

    if (error) {
      setErro('Erro ao carregar pedidos: ' + error.message)
    } else {
      setPedidos(data ?? [])
      setErro('')
    }
    setLoading(false)
  }

  async function avancarStatus(id: string, statusAtual: string) {
    setAvancando(id)
    setErro('')

    try {
      const res  = await fetch('/api/parceiro/pedido-status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pedido_id: id }),
      })
      const json = await res.json()

      if (!res.ok || json.erro) {
        setErro(json.erro ?? 'Erro ao atualizar pedido.')
      } else {
        setPedidos(prev => prev.map(p => p.id === id ? { ...p, status: json.novo_status } : p))
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    }
    setAvancando(null)
  }

  const filtrados = pedidos.filter(p => {
    if (filtro !== 'todos' && p.status !== filtro) return false
    if (busca) {
      const b = busca.toLowerCase()
      return p.id.toLowerCase().includes(b) ||
        (p.clientes?.perfis?.nome ?? '').toLowerCase().includes(b)
    }
    return true
  })

  const pedidoSelecionado = pedidos.find(p => p.id === selecionado)

  return (
    <div style={s.wrap}>
      <audio ref={audioRef} src="/sons/alerta.mp3" preload="auto" />

      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Pedidos</h1>
        <span style={s.badge}>
          {pedidos.length} ativo{pedidos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {erro && <div style={s.erroBox}>⚠️ {erro}</div>}

      <input style={s.busca} placeholder="🔍 Buscar por ID ou cliente…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      <div style={s.tabs}>
        {['todos', ...Object.keys(STATUS)].map(st => (
          <button key={st} onClick={() => setFiltro(st)}
            style={{ ...s.tab, ...(filtro === st ? s.tabAtivo : {}) }}>
            {st === 'todos' ? 'Todos' : STATUS[st]?.label ?? st}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: TEXTO_MEIO }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={s.vazio}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <p style={{ fontWeight: 700, color: TEXTO_MEIO }}>
            {pedidos.length === 0 ? 'Nenhum pedido no momento' : 'Nenhum pedido com este filtro'}
          </p>
        </div>
      ) : (
        <div style={s.conteudo}>
          {/* Grade de cards */}
          <div style={s.grid}>
            {filtrados.map(p => {
              const st         = STATUS[p.status] ?? { cor: '#999', bg: '#F3F4F6', label: p.status }
              const carregando = avancando === p.id
              const ativo      = selecionado === p.id

              return (
                <div key={p.id}
                  onClick={() => setSelecionado(ativo ? null : p.id)}
                  style={{
                    ...s.card,
                    borderLeft: `4px solid ${st.cor}`,
                    outline: ativo ? `2px solid ${AZUL}` : 'none',
                    opacity: carregando ? 0.7 : 1,
                    cursor: 'pointer',
                  }}>

                  {/* Header */}
                  <div style={s.cardTop}>
                    <span style={s.cardId}>#{p.id.slice(0, 8).toUpperCase()}</span>
                    <span style={{ ...s.pill, background: st.bg, color: st.cor }}>{st.label}</span>
                  </div>

                  {/* Infos */}
                  <div style={s.infos}>
                    <div style={s.infoLinha}>
                      <span style={s.infoL}>Cliente</span>
                      <span style={s.infoV}>{p.clientes?.perfis?.nome ?? '—'}</span>
                    </div>
                    <div style={s.infoLinha}>
                      <span style={s.infoL}>Entregador</span>
                      <span style={s.infoV}>{p.entregadores?.perfis?.nome ?? '—'}</span>
                    </div>
                    <div style={s.infoLinha}>
                      <span style={s.infoL}>Total</span>
                      <span style={{ ...s.infoV, fontWeight: 800, color: AZUL }}>{formatBRL(p.total)}</span>
                    </div>
                    <div style={s.infoLinha}>
                      <span style={s.infoL}>Hora</span>
                      <span style={s.infoV}>
                        {new Date(p.criado_em).toLocaleTimeString('pt-BR', {
                          hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande',
                        })}
                      </span>
                    </div>
                  </div>

                  {p.endereco_entrega && (
                    <div style={s.endereco}>📍 {p.endereco_entrega}</div>
                  )}

                  {/* Ações */}
                  {['pago', 'em_separacao'].includes(p.status) && (
                    <div style={s.acoes}>
                      <BtnAcao
                        label={p.status === 'pago' ? '📦 Iniciar separação' : '✅ Marcar como pronto'}
                        cor={p.status === 'pago' ? '#6D28D9' : '#0E7490'}
                        loading={carregando}
                        onClick={e => { e.stopPropagation(); avancarStatus(p.id, p.status) }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Painel de detalhe lateral */}
          {pedidoSelecionado && (
            <div style={s.detalhe}>
              <div style={s.detalheTop}>
                <span style={s.detalheId}>
                  Pedido #{pedidoSelecionado.id.slice(0, 8).toUpperCase()}
                </span>
                <button onClick={() => setSelecionado(null)} style={s.btnFechar}>✕</button>
              </div>

              <div style={s.detalheSecao}>Itens</div>
              {(pedidoSelecionado.pedido_itens ?? []).map((it: any, i: number) => (
                <div key={i} style={s.itemRow}>
                  <span style={s.itemNome}>{it.quantidade}× {it.produtos?.nome}</span>
                  <span style={s.itemPreco}>{formatBRL(it.preco_unitario * it.quantidade)}</span>
                </div>
              ))}

              <div style={s.divider} />

              <div style={{ ...s.itemRow, fontWeight: 800, fontSize: 15, color: AZUL }}>
                <span>Total</span>
                <span>{formatBRL(pedidoSelecionado.total)}</span>
              </div>

              <div style={s.detalheSecao}>Entrega</div>
              <div style={s.enderecoBox}>{pedidoSelecionado.endereco_entrega}</div>

              {pedidoSelecionado.clientes?.perfis && (
                <>
                  <div style={s.detalheSecao}>Cliente</div>
                  <div style={s.entregadorRow}>
                    <span style={s.entregadorNome}>
                      {pedidoSelecionado.clientes.perfis.nome}
                    </span>
                    <a href={`https://wa.me/55${pedidoSelecionado.clientes.perfis.telefone?.replace(/\D/g, '')}`}
                      target="_blank" rel="noreferrer" style={s.btnWhatsMini}>💬</a>
                  </div>
                </>
              )}

              {pedidoSelecionado.entregadores?.perfis && (
                <>
                  <div style={s.detalheSecao}>Entregador</div>
                  <div style={s.entregadorRow}>
                    <span style={s.entregadorNome}>
                      {pedidoSelecionado.entregadores.perfis.nome}
                    </span>
                    <a href={`https://wa.me/55${pedidoSelecionado.entregadores.perfis.telefone?.replace(/\D/g, '')}`}
                      target="_blank" rel="noreferrer" style={s.btnWhatsMini}>💬</a>
                  </div>
                  <div style={s.codigoBox}>
                    Código de confirmação:{' '}
                    <strong style={{ letterSpacing: 4, fontSize: 18 }}>
                      {pedidoSelecionado.codigo_confirmacao}
                    </strong>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BtnAcao({ label, cor, onClick, loading }: {
  label: string; cor: string; onClick: (e: React.MouseEvent) => void; loading: boolean
}) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{
        padding: '6px 10px',
        background: cor + '15',
        border: `1.5px solid ${cor}`,
        borderRadius: 7,
        color: loading ? cor + '60' : cor,
        fontSize: 11,
        fontWeight: 800,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: loading ? 0.6 : 1,
      }}>
      {loading ? '...' : label}
    </button>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:          { display: 'flex', flexDirection: 'column', gap: 16 },
  cabecalho:     { display: 'flex', alignItems: 'center', gap: 12 },
  titulo:        { fontSize: 22, fontWeight: 800, color: '#1A2340', margin: 0 },
  badge:         { background: '#FEE2E2', color: '#991B1B', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  erroBox:       { background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#DC2626' },
  busca:         { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#1A2340', background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' },
  tabs:          { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  tab:           { padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${CINZA_BORDA}`, background: '#fff', fontSize: 11, fontWeight: 700, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' },
  tabAtivo:      { background: AZUL, color: '#fff', borderColor: AZUL },
  vazio:         { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 10 },
  conteudo:      { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' },
  grid:          { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 },
  card:          { background: '#fff', borderRadius: 12, padding: '14px', boxShadow: '0 1px 6px rgba(27,47,94,0.08)', display: 'flex', flexDirection: 'column', gap: 10, transition: 'opacity 0.2s' },
  cardTop:       { display: 'flex', alignItems: 'center', gap: 8 },
  cardId:        { fontSize: 12, fontWeight: 800, color: '#1A2340', fontFamily: 'monospace', flex: 1 },
  pill:          { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' as const },
  infos:         { display: 'flex', flexDirection: 'column', gap: 4 },
  infoLinha:     { display: 'flex', gap: 6, alignItems: 'baseline' },
  infoL:         { fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, width: 68, flexShrink: 0 },
  infoV:         { fontSize: 12, fontWeight: 600, color: '#1A2340' },
  endereco:      { fontSize: 11, color: '#64748B', background: '#F8FAFC', borderRadius: 6, padding: '6px 8px' },
  acoes:         { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  detalhe:       { background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 76 },
  detalheTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  detalheId:     { fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: AZUL },
  btnFechar:     { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94A3B8' },
  detalheSecao:  { fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: 4 },
  itemRow:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 },
  itemNome:      { color: '#1A2340', fontWeight: 600 },
  itemPreco:     { fontWeight: 700, color: '#1A2340' },
  divider:       { height: 1, background: '#E2E8F0' },
  enderecoBox:   { background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#475569', lineHeight: 1.5 },
  entregadorRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  entregadorNome:{ fontSize: 14, fontWeight: 700, color: '#1A2340' },
  btnWhatsMini:  { background: '#DCFCE7', color: '#15803D', padding: '6px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 700, border: '1px solid #86EFAC' },
  codigoBox:     { background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#64748B', textAlign: 'center' as const, lineHeight: 2 },
}
