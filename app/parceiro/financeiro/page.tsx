'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, TEXTO, TEXTO_MEIO, CINZA_BORDA, RODAPE, formatBRL, linkWhats } from '@/lib/constants'

export default function ParceiroFinanceiro() {
  const router = useRouter()
  const [saldo, setSaldo]         = useState(0)
  const [pix, setPix]             = useState('')
  const [pixTipo, setPixTipo]     = useState('cpf')
  const [transacoes, setTransacoes] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [salvandoPix, setSalvandoPix] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('parceiros').select('id, saldo, pix_chave, pix_tipo').eq('usuario_id', user.id).single()
    if (!p) return
    setSaldo(p.saldo ?? 0)
    setPix(p.pix_chave ?? '')
    setPixTipo(p.pix_tipo ?? 'cpf')

    const { data: tx } = await supabase.from('transacoes')
      .select('tipo, valor, descricao, criado_em, status')
      .eq('usuario_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(20)
    setTransacoes(tx ?? [])
    setLoading(false)
  }

  async function salvarPix() {
    setSalvandoPix(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('parceiros').update({ pix_chave: pix, pix_tipo: pixTipo }).eq('usuario_id', user!.id)
    setSalvandoPix(false)
  }

  const proxSexta = (() => {
    const d = new Date(); const dia = d.getDay()
    const diff = dia <= 5 ? 5 - dia : 7 - dia + 5
    d.setDate(d.getDate() + diff); d.setHours(14,0,0,0)
    return d.toLocaleString('pt-BR', { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
  })()

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <h1 style={s.titulo}>Financeiro</h1>
      </div>

      {/* Saldo */}
      <div style={s.saldoCard}>
        <div style={s.saldoLabel}>Saldo disponível</div>
        <div style={s.saldoValor}>{formatBRL(saldo)}</div>
        <div style={s.proxSaque}>💰 Próximo saque automático: {proxSexta}</div>
      </div>

      {/* PIX */}
      <div style={s.card}>
        <h3 style={s.secao}>Chave PIX para recebimento</h3>
        <div style={s.pixRow}>
          <select style={s.select} value={pixTipo} onChange={e => setPixTipo(e.target.value)}>
            {['cpf','cnpj','telefone','email','aleatoria'].map(t => <option key={t}>{t}</option>)}
          </select>
          <input style={s.input} value={pix} onChange={e => setPix(e.target.value)} placeholder="Sua chave PIX…" />
          <button onClick={salvarPix} disabled={salvandoPix} style={s.btnSalvar}>
            {salvandoPix ? '💾' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Saque antecipado */}
      <div style={s.card}>
        <h3 style={s.secao}>Saque antecipado</h3>
        <p style={s.textoCard}>Precisa do saldo antes da sexta? Solicite ao Admin via WhatsApp. Sujeito a aprovação.</p>
        <a href={linkWhats(`Olá, gostaria de solicitar um saque antecipado. Saldo atual: ${formatBRL(saldo)}`)}
          target="_blank" rel="noreferrer" style={s.btnWhats}>
          💬 Solicitar saque antecipado
        </a>
      </div>

      {/* Extrato */}
      <div style={s.card}>
        <h3 style={s.secao}>Últimas movimentações</h3>
        {loading ? (
          <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
        ) : transacoes.length === 0 ? (
          <p style={s.vazio}>Nenhuma movimentação ainda.</p>
        ) : (
          <div style={s.extrato}>
            {transacoes.map((tx, i) => (
              <div key={i} style={s.txRow}>
                <div>
                  <div style={s.txDesc}>{tx.descricao}</div>
                  <div style={s.txData}>{new Date(tx.criado_em).toLocaleString('pt-BR')}</div>
                </div>
                <span style={{ ...s.txValor, color: tx.tipo === 'credito' ? VERDE : VERMELHO }}>
                  {tx.tipo === 'credito' ? '+' : '-'}{formatBRL(tx.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={s.rodape}>{RODAPE}</p>
    </div>
  )
}

const VERMELHO = '#EF4444'
const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:16 },
  cabecalho: { display:'flex', alignItems:'center', gap:12 },
  voltar: { background:'none', border:'none', color:TEXTO_MEIO, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  saldoCard: { background:AZUL, borderRadius:16, padding:'24px', display:'flex', flexDirection:'column', alignItems:'center', gap:6 },
  saldoLabel: { fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.08em' },
  saldoValor: { fontSize:36, fontWeight:900, color:'#fff', lineHeight:1 },
  proxSaque: { fontSize:12, color:DOURADO, fontWeight:700 },
  card: { background:'#fff', borderRadius:14, padding:'18px', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column', gap:12 },
  secao: { fontSize:13, fontWeight:800, color:TEXTO },
  pixRow: { display:'flex', gap:8 },
  select: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:8, padding:'10px', fontSize:12, color:TEXTO, background:'#fff', outline:'none', fontFamily:'inherit' },
  input: { flex:1, border:`1.5px solid ${CINZA_BORDA}`, borderRadius:8, padding:'10px 12px', fontSize:13, color:TEXTO, outline:'none', fontFamily:'inherit' },
  btnSalvar: { background:AZUL, color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  textoCard: { fontSize:13, color:TEXTO_MEIO, lineHeight:1.6 },
  btnWhats: { display:'block', padding:'12px', background:'#25D36620', color:'#25D366', borderRadius:10, textAlign:'center' as const, fontSize:13, fontWeight:700, textDecoration:'none', border:'1px solid #25D36630' },
  loading: { display:'flex', justifyContent:'center', padding:30 },
  spinner: { width:24, height:24, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  vazio: { fontSize:13, color:TEXTO_MEIO, textAlign:'center' as const, padding:'20px 0' },
  extrato: { display:'flex', flexDirection:'column', gap:0 },
  txRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:`1px solid ${CINZA_BORDA}` },
  txDesc: { fontSize:13, fontWeight:600, color:TEXTO },
  txData: { fontSize:11, color:TEXTO_MEIO, marginTop:2 },
  txValor: { fontSize:15, fontWeight:800 },
  rodape: { fontSize:11, color:'#aaa', textAlign:'center' as const, marginTop:8 },
}
