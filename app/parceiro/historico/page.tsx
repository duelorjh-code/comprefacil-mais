'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, RODAPE, formatBRL, linkWhats } from '@/lib/constants'

type Periodo = 'hoje' | 'semana' | 'mes'

export default function ParceiroHistorico() {
  const router = useRouter()
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [periodo])

  async function carregar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('parceiros').select('id').eq('usuario_id', user.id).single()
    if (!p) return

    const agora = new Date()
    let desde: Date
    if (periodo === 'hoje') { desde = new Date(agora); desde.setHours(0,0,0,0) }
    else if (periodo === 'semana') { desde = new Date(agora); desde.setDate(agora.getDate() - 7) }
    else { desde = new Date(agora); desde.setDate(agora.getDate() - 30) }

    const { data } = await supabase.from('pedidos')
      .select(`id, status, total, valor_produtos, taxa_entrega, criado_em,
               clientes ( perfis ( nome ) )`)
      .eq('parceiro_id', p.id)
      .in('status', ['entregue','cancelado','reembolsado'])
      .gte('criado_em', desde.toISOString())
      .order('criado_em', { ascending: false })
    setPedidos(data ?? [])
    setLoading(false)
  }

  const totalFat = pedidos.filter(p => p.status === 'entregue').reduce((a, p) => a + p.valor_produtos, 0)

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <h1 style={s.titulo}>Histórico</h1>
      </div>

      <div style={s.tabs}>
        {(['hoje','semana','mes'] as Periodo[]).map(p => (
          <button key={p} onClick={() => setPeriodo(p)}
            style={{ ...s.tab, ...(periodo===p ? s.tabAtivo : {}) }}>
            {p === 'hoje' ? 'Hoje' : p === 'semana' ? '7 dias' : '30 dias'}
          </button>
        ))}
      </div>

      <div style={s.resumo}>
        <div style={s.resumoItem}>
          <span style={s.resumoLabel}>Pedidos</span>
          <span style={s.resumoValor}>{pedidos.length}</span>
        </div>
        <div style={s.resumoItem}>
          <span style={s.resumoLabel}>Entregues</span>
          <span style={{ ...s.resumoValor, color: VERDE }}>{pedidos.filter(p => p.status === 'entregue').length}</span>
        </div>
        <div style={s.resumoItem}>
          <span style={s.resumoLabel}>Faturamento</span>
          <span style={{ ...s.resumoValor, color: AZUL }}>{formatBRL(totalFat)}</span>
        </div>
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : pedidos.length === 0 ? (
        <div style={s.vazio}>Nenhum pedido finalizado neste período.</div>
      ) : (
        <div style={s.lista}>
          {pedidos.map(p => (
            <div key={p.id} style={s.card}>
              <div style={s.cardTop}>
                <span style={s.id}>#{p.id.slice(0,8).toUpperCase()}</span>
                <span style={{ ...s.pill, background: p.status === 'entregue' ? '#22C55E20' : '#EF444420', color: p.status === 'entregue' ? VERDE : VERMELHO }}>
                  {p.status}
                </span>
                <span style={s.valor}>{formatBRL(p.valor_produtos)}</span>
              </div>
              <div style={s.cardInfo}>
                <span style={s.cliente}>{p.clientes?.perfis?.nome}</span>
                <span style={s.data}>{new Date(p.criado_em).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={s.acima30}>
        <p style={s.acima30Texto}>Precisa de histórico acima de 30 dias?</p>
        <a href={linkWhats('Olá, preciso do histórico de pedidos acima de 30 dias.')}
          target="_blank" rel="noreferrer" style={s.btnWhats}>
          💬 Solicitar ao Admin
        </a>
      </div>

      <p style={s.rodape}>{RODAPE}</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:16 },
  cabecalho: { display:'flex', alignItems:'center', gap:12 },
  voltar: { background:'none', border:'none', color:TEXTO_MEIO, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  tabs: { display:'flex', gap:8, background:'#F4F6FB', borderRadius:12, padding:4 },
  tab: { flex:1, padding:'10px', borderRadius:10, border:'none', background:'transparent', fontSize:13, fontWeight:700, color:TEXTO_MEIO, cursor:'pointer', fontFamily:'inherit' },
  tabAtivo: { background:'#fff', color:AZUL, boxShadow:'0 1px 6px rgba(0,0,0,0.08)' },
  resumo: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 },
  resumoItem: { background:'#fff', borderRadius:12, padding:'14px', display:'flex', flexDirection:'column', gap:4, alignItems:'center', boxShadow:'0 1px 6px rgba(27,47,94,0.06)' },
  resumoLabel: { fontSize:11, color:TEXTO_MEIO, fontWeight:600, textTransform:'uppercase' as const },
  resumoValor: { fontSize:20, fontWeight:800, color:TEXTO },
  loading: { display:'flex', justifyContent:'center', padding:40 },
  spinner: { width:28, height:28, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  vazio: { textAlign:'center' as const, padding:40, color:TEXTO_MEIO, fontSize:13 },
  lista: { display:'flex', flexDirection:'column', gap:8 },
  card: { background:'#fff', borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 6px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column', gap:6 },
  cardTop: { display:'flex', alignItems:'center', gap:10 },
  id: { fontSize:12, fontWeight:800, color:AZUL, fontFamily:'monospace' },
  pill: { fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20 },
  valor: { marginLeft:'auto', fontSize:14, fontWeight:800, color:AZUL },
  cardInfo: { display:'flex', justifyContent:'space-between' },
  cliente: { fontSize:13, color:TEXTO, fontWeight:600 },
  data: { fontSize:11, color:TEXTO_MEIO },
  acima30: { background:'#EEF2FF', borderRadius:12, padding:'16px', display:'flex', flexDirection:'column', gap:10 },
  acima30Texto: { fontSize:13, color:TEXTO_MEIO },
  btnWhats: { display:'block', padding:'11px', background:'#25D36620', color:'#25D366', borderRadius:10, textAlign:'center' as const, fontSize:13, fontWeight:700, textDecoration:'none', border:'1px solid #25D36630' },
  rodape: { fontSize:11, color:'#aaa', textAlign:'center' as const },
}
