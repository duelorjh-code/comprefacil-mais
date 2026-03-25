'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, RODAPE, formatBRL, linkWhats } from '@/lib/constants'

const TIMELINE = [
  { status: 'pago',           icon: '💳', label: 'Pagamento confirmado' },
  { status: 'em_separacao',   icon: '📦', label: 'Separando produtos'   },
  { status: 'pronto',         icon: '✅', label: 'Pronto para entrega'  },
  { status: 'a_caminho',      icon: '🛵', label: 'A caminho'            },
  { status: 'entregue',       icon: '🎉', label: 'Entregue!'            },
]

const ORDEM: Record<string, number> = {
  aguardando_pagamento: -1, pago: 0, em_separacao: 1, pronto: 2, a_caminho: 3, entregue: 4,
}

export default function PedidoConteudo() {
  const router      = useRouter()
  const params      = useSearchParams()
  const pedidoId    = params.get('id')
  const [pedido, setPedido]     = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [nota, setNota]         = useState(0)
  const [avaliado, setAvaliado] = useState(false)
  const [slaRestante, setSlaRestante] = useState('')

  useEffect(() => {
    if (!pedidoId) { router.replace('/vitrine'); return }
    carregar()
    const canal = supabase.channel('pedido-' + pedidoId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` }, () => carregar())
      .subscribe()
    const timer = setInterval(() => atualizarSla(), 1000)
    return () => { supabase.removeChannel(canal); clearInterval(timer) }
  }, [pedidoId])

  async function carregar() {
    const { data } = await supabase.from('pedidos')
      .select(`id, status, total, valor_produtos, taxa_entrega, taxa_conveniencia,
        sla_minutos, tempo_limite, endereco_entrega, codigo_confirmacao, criado_em,
        pedido_itens ( quantidade, preco_unitario, produtos ( nome ) ),
        entregadores ( id, perfis ( nome, telefone ) ),
        parceiros ( nome_fantasia )`)
      .eq('id', pedidoId!)
      .single()
    setPedido(data)
    setLoading(false)
  }

  function atualizarSla() {
    if (!pedido?.tempo_limite) return
    const ms = new Date(pedido.tempo_limite).getTime() - Date.now()
    if (ms <= 0) { setSlaRestante('Entrega atrasada'); return }
    const m = Math.floor(ms / 60_000)
    const s = Math.floor((ms % 60_000) / 1000)
    setSlaRestante(`${m}min ${s.toString().padStart(2, '0')}s`)
  }

  async function cancelar() {
    if (!confirm('Cancelar o pedido?')) return
    await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', pedidoId!)
    router.replace('/vitrine')
  }

  async function avaliar(n: number) {
    setNota(n)
    if (!pedido?.entregadores?.id) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: c } = await supabase.from('clientes').select('id').eq('usuario_id', user!.id).single()
    await supabase.from('avaliacoes').insert({
      pedido_id: pedidoId, cliente_id: c!.id,
      entregador_id: pedido.entregadores.id, nota: n,
    })
    setAvaliado(true)
  }

  if (loading) return (
    <div style={s.page}>
      <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
    </div>
  )

  if (!pedido) return (
    <div style={s.page}>
      <div style={s.vazio}>
        <div style={{ fontSize: 48 }}>📭</div>
        <p style={{ fontWeight: 700 }}>Pedido não encontrado.</p>
        <button onClick={() => router.replace('/vitrine')} style={s.btnPrimario}>Ir para vitrine</button>
      </div>
    </div>
  )

  const ordemAtual = ORDEM[pedido.status] ?? -1
  const cancelavel = !['a_caminho', 'entregue', 'cancelado', 'reembolsado'].includes(pedido.status)

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <button onClick={() => router.push('/vitrine')} style={s.voltar}>← Início</button>
        <span style={s.topTitulo}>Meu pedido</span>
      </header>

      <div style={s.conteudo}>
        <div style={s.statusCard}>
          <div style={s.statusIcone}>
            {pedido.status === 'entregue' ? '🎉' :
             pedido.status === 'cancelado' ? '❌' :
             pedido.status === 'a_caminho' ? '🛵' : '📦'}
          </div>
          <div style={s.statusTexto}>
            {pedido.status === 'entregue'     ? 'Pedido entregue!' :
             pedido.status === 'cancelado'    ? 'Pedido cancelado' :
             pedido.status === 'a_caminho'    ? 'Seu pedido está a caminho!' :
             pedido.status === 'pronto'       ? 'Aguardando entregador' :
             pedido.status === 'em_separacao' ? 'Sendo separado...' :
             'Pagamento confirmado!'}
          </div>
          {pedido.status === 'a_caminho' && slaRestante && (
            <div style={s.slaTimer}>⏱ {slaRestante}</div>
          )}
        </div>

        <div style={s.card}>
          <h3 style={s.cardTitulo}>Acompanhamento</h3>
          <div style={s.timeline}>
            {TIMELINE.map((step, i) => {
              const feito = ORDEM[step.status] <= ordemAtual
              const atual = ORDEM[step.status] === ordemAtual
              return (
                <div key={step.status} style={s.timelineItem}>
                  <div style={s.timelineLinha}>
                    <div style={{ ...s.timelineDot, background: feito ? VERDE : CINZA_BORDA, transform: atual ? 'scale(1.3)' : 'scale(1)' }}>
                      {feito ? '✓' : ''}
                    </div>
                    {i < TIMELINE.length - 1 && (
                      <div style={{ ...s.timelineConector, background: feito && ORDEM[TIMELINE[i+1].status] <= ordemAtual ? VERDE : CINZA_BORDA }} />
                    )}
                  </div>
                  <div style={s.timelineInfo}>
                    <span style={{ ...s.timelineLabel, fontWeight: atual ? 800 : 600, color: feito ? TEXTO : TEXTO_MEIO }}>
                      {step.icon} {step.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {pedido.entregadores && (
          <div style={s.card}>
            <h3 style={s.cardTitulo}>Seu entregador</h3>
            <div style={s.entregadorRow}>
              <div style={s.entregadorIcone}>🛵</div>
              <div style={s.entregadorInfo}>
                <div style={s.entregadorNome}>{pedido.entregadores.perfis?.nome}</div>
                <div style={s.entregadorSub}>Código: <strong style={{ letterSpacing: 3 }}>{pedido.codigo_confirmacao}</strong></div>
              </div>
              <a href={`https://wa.me/55${pedido.entregadores.perfis?.telefone?.replace(/\D/g,'')}?text=Olá, estou aguardando meu pedido CompreFácil+.`}
                target="_blank" rel="noreferrer" style={s.btnWhatsEnt}>💬</a>
            </div>
          </div>
        )}

        <div style={s.card}>
          <h3 style={s.cardTitulo}>Resumo</h3>
          <div style={s.itens}>
            {(pedido.pedido_itens ?? []).map((it: any, i: number) => (
              <div key={i} style={s.itemRow}>
                <span style={s.itemNome}>{it.quantidade}× {it.produtos?.nome}</span>
                <span style={s.itemPreco}>{formatBRL(it.preco_unitario * it.quantidade)}</span>
              </div>
            ))}
          </div>
          <div style={s.divider} />
          <div style={s.resumoRows}>
            <div style={s.resumoRow}><span>Produtos</span><span>{formatBRL(pedido.valor_produtos)}</span></div>
            <div style={s.resumoRow}><span>Entrega</span><span>{formatBRL(pedido.taxa_entrega)}</span></div>
            <div style={s.resumoRow}><span>Conveniência</span><span>{formatBRL(pedido.taxa_conveniencia)}</span></div>
            <div style={{ ...s.resumoRow, fontWeight: 800, color: AZUL, fontSize: 16 }}>
              <span>Total</span><span>{formatBRL(pedido.total)}</span>
            </div>
          </div>
        </div>

        {pedido.status === 'entregue' && pedido.entregadores && !avaliado && (
          <div style={s.card}>
            <h3 style={s.cardTitulo}>Avalie o entregador</h3>
            <div style={s.estrelas}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => avaliar(n)} style={s.estrela}>
                  {n <= nota ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            {nota > 0 && <p style={{ fontSize: 13, color: VERDE, textAlign: 'center' as const }}>Obrigado pela avaliação!</p>}
          </div>
        )}

        <div style={s.acoes}>
          <a href={linkWhats(`Olá, preciso de ajuda com meu pedido #${pedidoId?.slice(0,8).toUpperCase()}`)}
            target="_blank" rel="noreferrer" style={s.btnWhatsAcao}>
            💬 Falar com suporte
          </a>
          {cancelavel && (
            <button onClick={cancelar} style={s.btnCancelar}>Cancelar pedido</button>
          )}
        </div>
      </div>

      <nav style={s.bottomNav}>
        {[
          { icon: '🏠', label: 'Início', href: '/vitrine' },
          { icon: '🛒', label: 'Carrinho', href: '/carrinho' },
          { icon: '📦', label: 'Pedido', href: '/pedido' },
          { icon: '👤', label: 'Perfil', href: '/perfil' },
        ].map(item => (
          <button key={item.href} onClick={() => router.push(item.href)} style={s.navBtn}>
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <span style={s.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <p style={s.rodape}>{RODAPE}</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F4F6FB', fontFamily: "'Nunito', sans-serif", paddingBottom: 80 },
  topbar: { background: AZUL, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 },
  voltar: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  topTitulo: { color: '#fff', fontSize: 16, fontWeight: 800 },
  loading: { display: 'flex', justifyContent: 'center', padding: 80 },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  vazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 },
  conteudo: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto' },
  statusCard: { background: AZUL, borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' as const },
  statusIcone: { fontSize: 48, lineHeight: 1 },
  statusTexto: { fontSize: 18, fontWeight: 800, color: '#fff' },
  slaTimer: { fontSize: 14, fontWeight: 700, color: DOURADO, background: `${DOURADO}20`, padding: '6px 16px', borderRadius: 20 },
  card: { background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTitulo: { fontSize: 14, fontWeight: 800, color: TEXTO },
  timeline: { display: 'flex', flexDirection: 'column', gap: 0 },
  timelineItem: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  timelineLinha: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 },
  timelineDot: { width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 800, transition: 'all 0.3s', flexShrink: 0 },
  timelineConector: { width: 2, height: 24, transition: 'background 0.3s' },
  timelineInfo: { paddingBottom: 8, paddingTop: 2 },
  timelineLabel: { fontSize: 13 },
  entregadorRow: { display: 'flex', alignItems: 'center', gap: 12 },
  entregadorIcone: { fontSize: 32, background: '#EEF2FF', borderRadius: 12, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  entregadorInfo: { flex: 1 },
  entregadorNome: { fontSize: 14, fontWeight: 800, color: TEXTO },
  entregadorSub: { fontSize: 12, color: TEXTO_MEIO, marginTop: 2 },
  btnWhatsEnt: { background: '#25D36620', color: '#25D366', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 18, border: '1px solid #25D36630' },
  itens: { display: 'flex', flexDirection: 'column', gap: 6 },
  itemRow: { display: 'flex', justifyContent: 'space-between' },
  itemNome: { fontSize: 13, color: TEXTO, fontWeight: 600 },
  itemPreco: { fontSize: 13, fontWeight: 700, color: AZUL },
  divider: { height: 1, background: CINZA_BORDA },
  resumoRows: { display: 'flex', flexDirection: 'column', gap: 6 },
  resumoRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: TEXTO },
  estrelas: { display: 'flex', justifyContent: 'center', gap: 8 },
  estrela: { background: 'none', border: 'none', fontSize: 28, cursor: 'pointer' },
  acoes: { display: 'flex', flexDirection: 'column', gap: 10 },
  btnPrimario: { padding: '13px 28px', background: AZUL, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnWhatsAcao: { display: 'block', padding: '13px', background: '#25D36620', color: '#25D366', borderRadius: 12, textAlign: 'center' as const, fontSize: 14, fontWeight: 700, textDecoration: 'none', border: '1px solid #25D36630' },
  btnCancelar: { padding: '12px', background: '#EF444410', color: VERMELHO, border: '1px solid #EF444430', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E2E8F0', display: 'flex', padding: '6px 0', zIndex: 40, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' },
  navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontFamily: 'inherit', color: '#94A3B8' },
  navLabel: { fontSize: 10, fontWeight: 700 },
  rodape: { textAlign: 'center' as const, fontSize: 11, color: '#ccc', padding: '12px 16px 4px' },
}
