'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL, linkWhats } from '@/lib/constants'

const STATUS_LABEL: Record<string, string> = {
  pago: 'Pago', em_separacao: 'Separando', pronto: 'Pronto', a_caminho: 'A caminho', entregue: 'Entregue', cancelado: 'Cancelado',
}
const STATUS_COR: Record<string, { bg: string, color: string }> = {
  pago:         { bg: '#DBEAFE', color: '#1D4ED8' },
  em_separacao: { bg: '#FEF3C7', color: '#92400E' },
  pronto:       { bg: '#D1FAE5', color: '#065F46' },
  a_caminho:    { bg: '#F3E8FF', color: '#6B21A8' },
  entregue:     { bg: '#DCFCE7', color: '#15803D' },
  cancelado:    { bg: '#FEE2E2', color: '#DC2626' },
}

export default function ParceiroPedidos() {
  const [parcId, setParcId]   = useState('')
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState<string|null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('parceiros').select('id').eq('usuario_id', user.id).single()
      if (!p) return
      setParcId(p.id)
      carregar(p.id)

      const canal = supabase.channel('parceiro-pedidos-' + p.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `parceiro_id=eq.${p.id}` }, () => {
          carregar(p.id)
          try { audioRef.current?.play().catch(() => {}) } catch {}
        })
        .subscribe()
      return () => { supabase.removeChannel(canal) }
    }
    init()
  }, [])

  async function carregar(pid: string) {
    const { data } = await supabase.from('pedidos')
      .select(`id, status, total, criado_em, endereco_entrega, codigo_confirmacao,
               pedido_itens ( quantidade, preco_unitario, produtos ( nome ) ),
               clientes ( perfis ( nome, telefone ) ),
               entregadores ( perfis ( nome, telefone ) )`)
      .eq('parceiro_id', pid)
      .not('status', 'in', '(entregue,cancelado,reembolsado)')
      .order('criado_em', { ascending: true })
    setPedidos(data ?? [])
    setLoading(false)
  }

  async function avancarStatus(id: string, statusAtual: string) {
    const prox: Record<string, string> = {
      pago: 'em_separacao', em_separacao: 'pronto',
    }
    const novo = prox[statusAtual]
    if (!novo) return
    await supabase.from('pedidos').update({ status: novo }).eq('id', id)
    carregar(parcId)
  }

  const pedidoSelecionado = pedidos.find(p => p.id === selecionado)

  return (
    <div style={s.wrap}>
      <audio ref={audioRef} src="/sons/alerta.mp3" preload="auto" />

      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Pedidos ativos</h1>
          <p style={s.sub}>{pedidos.length === 0 ? 'Nenhum pedido no momento' : `${pedidos.length} pedido${pedidos.length>1?'s':''} aguardando`}</p>
        </div>
        <div style={s.badgePedidos}>
          {pedidos.length > 0
            ? <span style={s.badgeAtivo}>{pedidos.length} novo{pedidos.length>1?'s':''}</span>
            : <span style={s.badgeVazio}>Fila vazia</span>}
        </div>
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : pedidos.length === 0 ? (
        <div style={s.vazio}>
          <div style={{ fontSize: 56 }}>🎉</div>
          <div style={s.vazioTitulo}>Tudo em dia!</div>
          <div style={s.vazioSub}>Você será avisado sonoramente ao receber um novo pedido.</div>
        </div>
      ) : (
        <div style={s.grid}>
          {/* Lista */}
          <div style={s.lista}>
            {pedidos.map(p => {
              const cor = STATUS_COR[p.status] ?? { bg: '#F1F5F9', color: '#64748B' }
              return (
                <div key={p.id} onClick={() => setSelecionado(p.id === selecionado ? null : p.id)}
                  style={{ ...s.card, border: `2px solid ${selecionado===p.id ? AZUL : '#E2E8F0'}`, background: selecionado===p.id ? '#EFF6FF' : '#fff' }}>
                  <div style={s.cardTop}>
                    <span style={s.cardId}>#{p.id.slice(0,8).toUpperCase()}</span>
                    <span style={{ ...s.pill, background: cor.bg, color: cor.color }}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <div style={s.cardCliente}>{p.clientes?.perfis?.nome}</div>
                  <div style={s.cardInfo}>
                    <span style={s.cardTotal}>{formatBRL(p.total)}</span>
                    <span style={s.cardHora}>{new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {/* Botão avançar */}
                  {['pago','em_separacao'].includes(p.status) && (
                    <button onClick={e => { e.stopPropagation(); avancarStatus(p.id, p.status) }}
                      style={s.btnAvancar}>
                      {p.status === 'pago' ? '📦 Iniciar separação' : '✅ Marcar como pronto'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Detalhe */}
          {pedidoSelecionado && (
            <div style={s.detalhe}>
              <div style={s.detalheTop}>
                <span style={s.detalheId}>Pedido #{pedidoSelecionado.id.slice(0,8).toUpperCase()}</span>
                <button onClick={() => setSelecionado(null)} style={s.btnFechar}>✕</button>
              </div>

              {/* Itens */}
              <div style={s.detalheSecao}>Itens</div>
              {(pedidoSelecionado.pedido_itens ?? []).map((it: any, i: number) => (
                <div key={i} style={s.itemRow}>
                  <span style={s.itemNome}>{it.quantidade}× {it.produtos?.nome}</span>
                  <span style={s.itemPreco}>{formatBRL(it.preco_unitario * it.quantidade)}</span>
                </div>
              ))}

              <div style={s.divider} />

              {/* Resumo */}
              <div style={{ ...s.itemRow, fontWeight: 800, fontSize: 15, color: AZUL }}>
                <span>Total</span><span>{formatBRL(pedidoSelecionado.total)}</span>
              </div>

              {/* Endereço */}
              <div style={s.detalheSecao}>Entrega</div>
              <div style={s.enderecoBox}>{pedidoSelecionado.endereco_entrega}</div>

              {/* Entregador */}
              {pedidoSelecionado.entregadores && (
                <>
                  <div style={s.detalheSecao}>Entregador</div>
                  <div style={s.entregadorRow}>
                    <span style={s.entregadorNome}>{pedidoSelecionado.entregadores.perfis?.nome}</span>
                    <a href={`https://wa.me/55${pedidoSelecionado.entregadores.perfis?.telefone?.replace(/\D/g,'')}`}
                      target="_blank" rel="noreferrer" style={s.btnWhatsMini}>💬</a>
                  </div>
                  <div style={s.codigoBox}>
                    Código: <strong style={{ letterSpacing: 4 }}>{pedidoSelecionado.codigo_confirmacao}</strong>
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

const s: Record<string, React.CSSProperties> = {
  wrap:          { display: 'flex', flexDirection: 'column', gap: 16 },
  cabecalho:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  titulo:        { fontSize: 22, fontWeight: 800, color: '#1A2340', margin: 0 },
  sub:           { fontSize: 13, color: '#64748B', marginTop: 2 },
  badgePedidos:  {},
  badgeAtivo:    { background: '#DBEAFE', color: '#1D4ED8', fontWeight: 800, fontSize: 13, padding: '5px 14px', borderRadius: 20 },
  badgeVazio:    { background: '#F1F5F9', color: '#94A3B8', fontWeight: 700, fontSize: 13, padding: '5px 14px', borderRadius: 20 },
  loading:       { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:       { width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(27,47,94,0.15)', borderTopColor: AZUL, display: 'block' },
  vazio:         { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 12, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0' },
  vazioTitulo:   { fontSize: 20, fontWeight: 800, color: '#1A2340' },
  vazioSub:      { fontSize: 13, color: '#64748B', textAlign: 'center' as const },
  grid:          { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' },
  lista:         { display: 'flex', flexDirection: 'column', gap: 10 },
  card:          { background: '#fff', borderRadius: 12, padding: '14px', cursor: 'pointer', transition: 'border 0.2s', display: 'flex', flexDirection: 'column', gap: 8 },
  cardTop:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardId:        { fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#64748B' },
  pill:          { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  cardCliente:   { fontSize: 15, fontWeight: 800, color: '#1A2340' },
  cardInfo:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTotal:     { fontSize: 16, fontWeight: 800, color: AZUL },
  cardHora:      { fontSize: 12, color: '#94A3B8', fontWeight: 600 },
  btnAvancar:    { padding: '10px', background: AZUL, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const },
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
  codigoBox:     { background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#64748B', textAlign: 'center' as const },
}
