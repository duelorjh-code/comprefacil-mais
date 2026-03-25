'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const STATUS_LABEL: Record<string, string> = {
  pago: 'Novo pedido', em_separacao: 'Separando', pronto: 'Pronto p/ entrega',
  a_caminho: 'Saiu para entrega', entregue: 'Entregue', cancelado: 'Cancelado',
}

export default function ParceiroPedidos() {
  const [parcId, setParcId]       = useState('')
  const [pedidos, setPedidos]     = useState<any[]>([])
  const [modal, setModal]         = useState<string | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [loading, setLoading]     = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const tocarAlarme = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio('/sons/alerta.mp3')
    audioRef.current.play().catch(() => {})
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('parceiros').select('id').eq('usuario_id', user.id).single()
      if (!p) return
      setParcId(p.id)
      await carregar(p.id)

      supabase.channel('parceiro-ped')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `parceiro_id=eq.${p.id}` }, () => {
          carregar(p.id)
          tocarAlarme()
        })
        .subscribe()
    }
    init()
  }, [tocarAlarme])

  async function carregar(pid: string) {
    const { data } = await supabase.from('pedidos')
      .select(`id, status, total, valor_produtos, taxa_entrega, codigo_confirmacao,
               criado_em, sla_minutos, tempo_limite, endereco_entrega,
               pedido_itens ( quantidade, preco_unitario, produtos ( nome, unidade_medida, imagem_url ) ),
               clientes ( perfis ( nome, telefone ) )`)
      .eq('parceiro_id', pid)
      .not('status', 'in', '(entregue,cancelado,reembolsado)')
      .order('criado_em', { ascending: false })
    setPedidos(data ?? [])
    setLoading(false)
  }

  async function acao(pedidoId: string, novoStatus: string, just?: string) {
    const upd: any = { status: novoStatus }
    if (novoStatus === 'pago') {
      // Rejeitar — incrementa recusas se sem justificativa
      if (!just) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.rpc('incrementar_recusas', { p_usuario_id: user!.id })
      }
      await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', pedidoId)
    } else {
      await supabase.from('pedidos').update(upd).eq('id', pedidoId)
    }
    setModal(null)
    setJustificativa('')
    carregar(parcId)
  }

  function slaRestante(p: any): { texto: string; cor: string } {
    if (!p.tempo_limite) return { texto: '–', cor: TEXTO_MEIO }
    const ms  = new Date(p.tempo_limite).getTime() - Date.now()
    if (ms <= 0)    return { texto: 'VENCIDO', cor: VERMELHO }
    const min = Math.floor(ms / 60_000)
    const seg = Math.floor((ms % 60_000) / 1000)
    const cor = min > 15 ? VERDE : min > 5 ? LARANJA : VERMELHO
    return { texto: `${min}:${seg.toString().padStart(2,'0')}`, cor }
  }

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <h1 style={s.titulo}>Pedidos ativos</h1>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : pedidos.length === 0 ? (
        <div style={s.vazio}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <p>Nenhum pedido no momento.</p>
          <p style={{ fontSize: 13, color: TEXTO_MEIO }}>Você será avisado sonoramente ao receber um novo pedido.</p>
        </div>
      ) : (
        <div style={s.lista}>
          {pedidos.map(p => {
            const sla = slaRestante(p)
            return (
              <div key={p.id} style={{ ...s.card, ...(p.status === 'pago' ? s.cardNovo : {}) }}>
                {p.status === 'pago' && <div style={s.novoBadge} className="anim-blink">🔔 NOVO PEDIDO</div>}

                <div style={s.cardTop}>
                  <div style={s.pedidoId}>#{p.id.slice(0,8).toUpperCase()}</div>
                  <span style={{ ...s.statusPill, background: p.status === 'pago' ? DOURADO + '20' : '#3B82F620', color: p.status === 'pago' ? DOURADO : '#3B82F6' }}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  <span style={{ ...s.sla, color: sla.cor }}>⏱ {sla.texto}</span>
                </div>

                {/* Itens */}
                <div style={s.itens}>
                  {(p.pedido_itens ?? []).map((it: any, i: number) => (
                    <div key={i} style={s.item}>
                      {it.produtos?.imagem_url && <img src={it.produtos.imagem_url} alt="" style={s.itemImg} />}
                      <span style={s.itemNome}>{it.quantidade}× {it.produtos?.nome}</span>
                      <span style={s.itemPreco}>{formatBRL(it.preco_unitario * it.quantidade)}</span>
                    </div>
                  ))}
                </div>

                <div style={s.resumo}>
                  <span style={s.endereco}>📍 {p.endereco_entrega}</span>
                  <span style={s.total}>{formatBRL(p.total)}</span>
                </div>

                <div style={s.codigo}>
                  Código de confirmação: <strong style={{ letterSpacing: 4 }}>{p.codigo_confirmacao}</strong>
                </div>

                {/* Ações conforme status */}
                <div style={s.acoes}>
                  {p.status === 'pago' && <>
                    <button onClick={() => acao(p.id, 'em_separacao')} style={{ ...s.btn, background: AZUL, color: '#fff' }}>
                      ✓ Aceitar pedido
                    </button>
                    <button onClick={() => setModal(p.id)} style={{ ...s.btn, background: '#EF444420', color: VERMELHO }}>
                      ✕ Recusar
                    </button>
                  </>}
                  {p.status === 'em_separacao' && (
                    <button onClick={() => acao(p.id, 'pronto')} style={{ ...s.btn, background: '#22C55E20', color: VERDE }}>
                      ✓ Pedido pronto
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal rejeição */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={s.modalCard} className="anim-fadeUp">
            <h3 style={s.modalTitulo}>Recusar pedido</h3>
            <p style={{ fontSize: 13, color: TEXTO_MEIO }}>
              3 recusas sem justificativa resultam em bloqueio automático.
            </p>
            <textarea style={s.textarea} placeholder="Motivo da recusa (opcional — evita penalidade)…"
              value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={3} />
            <div style={s.modalAcoes}>
              <button onClick={() => setModal(null)} style={s.btnCancelar}>Voltar</button>
              <button onClick={() => acao(modal, 'pago', justificativa || undefined)}
                style={{ ...s.btn, background: '#EF444420', color: VERMELHO }}>
                Confirmar recusa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:16 },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:32, height:32, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  vazio: { textAlign:'center' as const, padding:'60px 20px', color:TEXTO_MEIO, display:'flex', flexDirection:'column', alignItems:'center', gap:10 },
  lista: { display:'flex', flexDirection:'column', gap:14 },
  card: { background:'#fff', borderRadius:14, padding:'18px', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column', gap:12 },
  cardNovo: { boxShadow:`0 0 0 2px ${DOURADO}`, borderRadius:14 },
  novoBadge: { background:DOURADO, color:'#fff', fontSize:12, fontWeight:800, padding:'6px 14px', borderRadius:10, textAlign:'center' as const, letterSpacing:'0.05em' },
  cardTop: { display:'flex', alignItems:'center', gap:10 },
  pedidoId: { fontWeight:800, fontSize:13, color:AZUL, fontFamily:'monospace' },
  statusPill: { fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 },
  sla: { marginLeft:'auto', fontSize:12, fontWeight:800 },
  itens: { display:'flex', flexDirection:'column', gap:6, background:'#F4F6FB', borderRadius:10, padding:'10px 12px' },
  item: { display:'flex', alignItems:'center', gap:10 },
  itemImg: { width:28, height:28, borderRadius:6, objectFit:'cover' },
  itemNome: { flex:1, fontSize:13, color:TEXTO, fontWeight:600 },
  itemPreco: { fontSize:13, fontWeight:700, color:AZUL },
  resumo: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  endereco: { fontSize:12, color:TEXTO_MEIO },
  total: { fontSize:16, fontWeight:800, color:AZUL },
  codigo: { fontSize:12, color:TEXTO_MEIO, background:'#EEF2FF', borderRadius:8, padding:'8px 12px', textAlign:'center' as const },
  acoes: { display:'flex', gap:10 },
  btn: { flex:1, padding:'12px', borderRadius:10, border:'none', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:16 },
  modalCard: { background:'#fff', borderRadius:20, padding:'24px', width:'100%', maxWidth:440, display:'flex', flexDirection:'column', gap:16 },
  modalTitulo: { fontSize:17, fontWeight:800, color:TEXTO },
  textarea: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'12px', fontSize:14, color:TEXTO, resize:'none' as const, fontFamily:'inherit', outline:'none' },
  modalAcoes: { display:'flex', gap:10 },
  btnCancelar: { flex:1, padding:'12px', borderRadius:10, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', color:TEXTO_MEIO },
}
