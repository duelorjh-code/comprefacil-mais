'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

const CAT_ICONS: Record<string,string> = { alimentos:'🥗', bebidas:'🥤', higiene:'🧴', limpeza:'🧹', farmacia:'💊', outros:'📦' }

export default function ParceiroEstoque() {
  const [produtos, setProdutos]   = useState<any[]>([])
  const [estoque, setEstoque]     = useState<Record<string, { id:string, preco:number, quantidade:number }>>({})
  const [parcId, setParcId]       = useState('')
  const [alterados, setAlterados] = useState<Record<string, { preco:number, quantidade:number }>>({})
  const [loading, setLoading]     = useState(true)
  const [salvando, setSalvando]   = useState(false)
  const [busca, setBusca]         = useState('')
  const [filtro, setFiltro]       = useState<'todos'|'com_estoque'>('todos')
  const [salvoMsg, setSalvoMsg]   = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('parceiros').select('id').eq('usuario_id', user.id).single()
    if (!p) return
    setParcId(p.id)

    const { data: prods } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome')
    setProdutos(prods ?? [])

    const { data: est } = await supabase.from('estoque')
      .select('id, produto_id, preco, quantidade')
      .eq('parceiro_id', p.id)

    const map: Record<string, { id:string, preco:number, quantidade:number }> = {}
    ;(est ?? []).forEach((e: any) => { map[e.produto_id] = { id: e.id, preco: e.preco, quantidade: e.quantidade } })
    setEstoque(map)
    setLoading(false)
  }

  // Preço: digita dígitos, formata como moeda
  function handlePreco(prodId: string, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const valor  = digits ? parseInt(digits) / 100 : 0
    const atual  = estoque[prodId] ?? { id:'', preco:0, quantidade:0 }
    const prev   = alterados[prodId] ?? { preco: atual.preco, quantidade: atual.quantidade }
    setAlterados(a => ({ ...a, [prodId]: { ...prev, preco: valor } }))
  }

  function handleQtd(prodId: string, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    const valor  = digits ? parseInt(digits) : 0
    const atual  = estoque[prodId] ?? { id:'', preco:0, quantidade:0 }
    const prev   = alterados[prodId] ?? { preco: atual.preco, quantidade: atual.quantidade }
    setAlterados(a => ({ ...a, [prodId]: { ...prev, quantidade: valor } }))
  }

  function getPreco(prodId: string) {
    const val = alterados[prodId]?.preco ?? estoque[prodId]?.preco ?? 0
    if (!val) return ''
    return val.toFixed(2).replace('.', ',')
  }

  function getQtd(prodId: string) {
    const val = alterados[prodId]?.quantidade ?? estoque[prodId]?.quantidade ?? 0
    return val || ''
  }

  async function salvarTudo() {
    const keys = Object.keys(alterados)
    if (keys.length === 0) return
    setSalvando(true)

    const res  = await fetch('/api/estoque', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alterados }),
    })
    const data = await res.json()

    setSalvando(false)
    if (!res.ok || data.erro) {
      setSalvoMsg('❌ Erro ao salvar. Tente novamente.')
    } else {
      setAlterados({})
      setSalvoMsg('✅ Enviado para aprovação do Admin!')
      carregar()
    }
    setTimeout(() => setSalvoMsg(''), 4000)
  }

  const qtdAlterados = Object.keys(alterados).length

  const filtrados = produtos.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtro === 'com_estoque') {
      const preco = alterados[p.id]?.preco ?? estoque[p.id]?.preco ?? 0
      const qtd   = alterados[p.id]?.quantidade ?? estoque[p.id]?.quantidade ?? 0
      return preco > 0 || qtd > 0
    }
    return true
  })

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Meu estoque</h1>
          <p style={s.sub}>Preencha preço e quantidade nos produtos que deseja vender</p>
        </div>
        <button onClick={salvarTudo} disabled={salvando || qtdAlterados===0}
          style={{ ...s.btnSalvar, opacity: qtdAlterados===0 ? 0.4 : 1 }}>
          {salvando ? '💾 Salvando...' : qtdAlterados>0 ? `💾 Salvar (${qtdAlterados})` : '💾 Salvar'}
        </button>
      </div>

      <div style={s.aviso}>
        📋 Foto, nome e categoria são controlados pelo Admin. Preencha apenas <strong>preço</strong> e <strong>quantidade</strong>. Produtos com preço ou quantidade zero não aparecem na vitrine.
      </div>

      {salvoMsg && (
        <div style={s.avisoSucesso}>{salvoMsg}</div>
      )}

      <div style={s.filtroRow}>
        <input style={s.busca} placeholder="🔍  Buscar produto…"
          value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={s.abas}>
          <button onClick={() => setFiltro('todos')} style={{ ...s.aba, ...(filtro==='todos'?s.abaAtiva:{}) }}>Todos</button>
          <button onClick={() => setFiltro('com_estoque')} style={{ ...s.aba, ...(filtro==='com_estoque'?s.abaAtiva:{}) }}>Com estoque</button>
        </div>
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.tabelaWrap}>
          <div style={s.thead}>
            <div style={{ width:52 }} />
            <div style={{ flex:3 }}>Produto</div>
            <div style={{ width:60, textAlign:'center' as const }}>Unid</div>
            <div style={{ width:130, textAlign:'center' as const }}>Preço (R$)</div>
            <div style={{ width:110, textAlign:'center' as const }}>Quantidade</div>
            <div style={{ width:90, textAlign:'center' as const }}>Status</div>
          </div>

          {filtrados.length === 0 && (
            <div style={{ padding:40, textAlign:'center' as const, color:TEXTO_MEIO }}>Nenhum produto encontrado.</div>
          )}

          {filtrados.map(p => {
            const preco    = getPreco(p.id)
            const qtd      = getQtd(p.id)
            const alterado = alterados[p.id] !== undefined
            const precoNum = alterados[p.id]?.preco ?? estoque[p.id]?.preco ?? 0
            const qtdNum   = alterados[p.id]?.quantidade ?? estoque[p.id]?.quantidade ?? 0
            const ativo    = precoNum > 0 && qtdNum > 0

            return (
              <div key={p.id} style={{ ...s.linha, background: alterado ? '#FFFBEB' : '#fff' }}>
                <div style={{ width:52 }}>
                  {p.imagem_url
                    ? <img src={p.imagem_url} alt={p.nome} style={s.miniThumb} />
                    : <div style={s.miniPlaceholder}>{CAT_ICONS[p.categoria]}</div>}
                </div>
                <div style={{ flex:3 }}>
                  <div style={s.linhaNome}>{p.nome}</div>
                  <div style={s.linhaCat}>{CAT_ICONS[p.categoria]} {p.categoria}</div>
                </div>
                <div style={{ width:60, textAlign:'center' as const, fontSize:12, color:TEXTO_MEIO, fontWeight:600 }}>{p.unidade_medida}</div>
                <div style={{ width:130 }}>
                  <input
                    type="text" inputMode="decimal"
                    value={preco}
                    onChange={e => handlePreco(p.id, e.target.value)}
                    placeholder="0,00"
                    style={{ ...s.inputTabela, borderColor: alterado ? DOURADO : CINZA_BORDA }}
                  />
                </div>
                <div style={{ width:110 }}>
                  <input
                    type="text" inputMode="numeric"
                    value={qtd}
                    onChange={e => handleQtd(p.id, e.target.value)}
                    placeholder="0"
                    style={{ ...s.inputTabela, borderColor: alterado ? DOURADO : CINZA_BORDA,
                      color: qtdNum===0 ? TEXTO_MEIO : qtdNum<=5 ? LARANJA : VERDE }}
                  />
                </div>
                <div style={{ width:90, textAlign:'center' as const }}>
                  <span style={{ ...s.pill, background: ativo?'#22C55E20':'#F4F6FB', color: ativo?VERDE:TEXTO_MEIO }}>
                    {ativo ? '✅ Ativo' : '○ Inativo'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {qtdAlterados > 0 && (
        <div style={s.floatSalvar}>
          <button onClick={salvarTudo} disabled={salvando} style={s.btnSalvarFloat}>
            {salvando ? '💾 Salvando...' : `💾 Salvar ${qtdAlterados} alteração(ões)`}
          </button>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:16, paddingBottom:80 },
  cabecalho: { display:'flex', alignItems:'flex-start', justifyContent:'space-between' },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  sub: { fontSize:13, color:TEXTO_MEIO, marginTop:2 },
  btnSalvar: { background:AZUL, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
  aviso: { background:'#EEF2FF', borderRadius:10, padding:'12px 16px', fontSize:13, color:AZUL, border:`1px solid #C7D2FE` },
  avisoSucesso: { background:'#22C55E15', border:'1.5px solid #22C55E40', borderRadius:10, padding:'12px 16px', fontSize:13, fontWeight:700, color:VERDE },
  filtroRow: { display:'flex', gap:12, alignItems:'center' },
  busca: { flex:1, border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, background:'#fff', outline:'none', fontFamily:'inherit', color:TEXTO },
  abas: { display:'flex', gap:6 },
  aba: { padding:'8px 14px', borderRadius:20, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit' },
  abaAtiva: { background:AZUL, color:'#fff', borderColor:AZUL },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:28, height:28, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  tabelaWrap: { background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', border:`1px solid ${CINZA_BORDA}` },
  thead: { display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'#F4F6FB', borderBottom:`1px solid ${CINZA_BORDA}`, fontSize:11, fontWeight:800, color:TEXTO_MEIO, textTransform:'uppercase' as const, letterSpacing:'0.05em' },
  linha: { display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:`1px solid ${CINZA_BORDA}`, transition:'background 0.2s' },
  miniThumb: { width:44, height:44, borderRadius:8, objectFit:'cover' as const },
  miniPlaceholder: { width:44, height:44, borderRadius:8, background:'#F4F6FB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 },
  linhaNome: { fontSize:13, fontWeight:700, color:TEXTO },
  linhaCat: { fontSize:11, color:TEXTO_MEIO, marginTop:2 },
  inputTabela: { width:'100%', border:'1.5px solid', borderRadius:8, padding:'8px 10px', fontSize:14, fontWeight:700, color:TEXTO, background:'#FAFBFE', outline:'none', fontFamily:'inherit', textAlign:'center' as const },
  pill: { fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20 },
  floatSalvar: { position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:50 },
  btnSalvarFloat: { background:AZUL, color:'#fff', border:'none', borderRadius:30, padding:'14px 32px', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 20px rgba(27,47,94,0.3)' },
}
