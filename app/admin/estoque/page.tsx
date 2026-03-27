'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const CAT_ICONS: Record<string,string> = { alimentos:'🥗', bebidas:'🥤', higiene:'🧴', limpeza:'🧹', farmacia:'💊', outros:'📦' }

export default function AdminEstoque() {
  const [parceiros, setParceiros]     = useState<any[]>([])
  const [parcId, setParcId]           = useState('')
  const [produtos, setProdutos]       = useState<any[]>([])
  const [estoque, setEstoque]         = useState<Record<string, { id:string, preco:number, quantidade:number, status_aprovacao:string }>>({})
  const [estoqueGlobal, setEstoqueGlobal] = useState<Record<string, any[]>>({})
  const [popover, setPopover]         = useState<string|null>(null)
  const [alterados, setAlterados]     = useState<Record<string, { preco:number, quantidade:number }>>({})
  const [loading, setLoading]         = useState(true)
  const [salvando, setSalvando]       = useState(false)
  const [busca, setBusca]             = useState('')

  useEffect(() => { carregarParceiros() }, [])
  useEffect(() => { if (parcId) carregarEstoque() }, [parcId])

  async function carregarParceiros() {
    const { data } = await supabase.from('parceiros').select('id, nome_fantasia').order('nome_fantasia')
    setParceiros(data ?? [])
    if (data && data.length > 0) setParcId(data[0].id)
  }

  async function carregarEstoqueGlobal() {
    const { data: est } = await supabase
      .from('estoque')
      .select('produto_id, preco, quantidade, status_aprovacao, parceiros ( nome_fantasia )')
      .gt('quantidade', 0).gt('preco', 0)
    const map: Record<string, any[]> = {}
    ;(est ?? []).forEach((e: any) => {
      if (!map[e.produto_id]) map[e.produto_id] = []
      map[e.produto_id].push({
        nome: e.parceiros?.nome_fantasia,
        preco: e.preco,
        quantidade: e.quantidade,
        status: e.status_aprovacao
      })
    })
    Object.keys(map).forEach(k => map[k].sort((a,b) => a.preco - b.preco))
    setEstoqueGlobal(map)
  }

  async function carregarEstoque() {
    setLoading(true)
    setAlterados({})
    setPopover(null)

    const { data: prods } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome')
    setProdutos(prods ?? [])

    const { data: est } = await supabase.from('estoque')
      .select('id, produto_id, preco, quantidade, status_aprovacao')
      .eq('parceiro_id', parcId)

    const map: Record<string, { id:string, preco:number, quantidade:number, status_aprovacao:string }> = {}
    ;(est ?? []).forEach((e: any) => { map[e.produto_id] = e })
    setEstoque(map)

    await carregarEstoqueGlobal()
    setLoading(false)
  }

  function handlePreco(prodId: string, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const valor  = digits ? parseInt(digits) / 100 : 0
    const atual  = estoque[prodId] ?? { id:'', preco:0, quantidade:0, status_aprovacao:'aprovado' }
    const prev   = alterados[prodId] ?? { preco: atual.preco, quantidade: atual.quantidade }
    setAlterados(a => ({ ...a, [prodId]: { ...prev, preco: valor } }))
  }

  function handleQtd(prodId: string, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    const valor  = digits ? parseInt(digits) : 0
    const atual  = estoque[prodId] ?? { id:'', preco:0, quantidade:0, status_aprovacao:'aprovado' }
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
      body: JSON.stringify({ parceiro_id: parcId, alterados }),
    })

    setSalvando(false)
    setAlterados({})
    carregarEstoque()
  }

  async function aprovarTudo() {
    const pendentes = Object.values(estoque).filter(e => e.status_aprovacao === 'pendente')
    await Promise.all(pendentes.map(e =>
      supabase.from('estoque').update({ status_aprovacao: 'aprovado' }).eq('id', e.id)
    ))
    carregarEstoque()
  }

  const qtdAlterados = Object.keys(alterados).length
  const qtdPendentes = Object.values(estoque).filter(e => e.status_aprovacao === 'pendente').length
  const filtrados    = produtos.filter(p => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Estoque</h1>
          <p style={s.sub}>Gerencie o estoque de cada parceiro</p>
        </div>
        <button onClick={salvarTudo} disabled={salvando || qtdAlterados===0}
          style={{ ...s.btnSalvar, opacity: qtdAlterados===0 ? 0.4 : 1 }}>
          {salvando ? '💾 Salvando...' : qtdAlterados>0 ? `💾 Salvar (${qtdAlterados})` : '💾 Salvar'}
        </button>
      </div>

      {/* Badge pendentes */}
      {qtdPendentes > 0 && (
        <div style={s.alertaPendente}>
          <span>⏳ {qtdPendentes} item(ns) aguardando aprovação da {parceiros.find(p=>p.id===parcId)?.nome_fantasia}</span>
          <button onClick={aprovarTudo} style={s.btnAprovar}>✅ Aprovar tudo</button>
        </div>
      )}

      {/* Abas parceiros */}
      <div style={s.parceirosAbas}>
        {parceiros.map(p => (
          <button key={p.id} onClick={() => setParcId(p.id)}
            style={{ ...s.aba, ...(parcId===p.id ? s.abaAtiva : {}) }}>
            🏪 {p.nome_fantasia}
          </button>
        ))}
      </div>

      <input style={s.busca} placeholder="🔍  Buscar produto…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.tabelaWrap}>
          <div style={s.thead}>
            <div style={{ width:52 }} />
            <div style={{ flex:3 }}>Produto</div>
            <div style={{ width:60, textAlign:'center' as const }}>Unid</div>
            <div style={{ width:130, textAlign:'center' as const }}>Preço (R$)</div>
            <div style={{ width:100, textAlign:'center' as const }}>Qtd</div>
            <div style={{ width:90, textAlign:'center' as const }}>Status</div>
            <div style={{ width:80, textAlign:'center' as const }}>Parceiros</div>
          </div>

          {filtrados.map(p => {
            const preco    = getPreco(p.id)
            const qtd      = getQtd(p.id)
            const alterado = alterados[p.id] !== undefined
            const item     = estoque[p.id]
            const pendente = item?.status_aprovacao === 'pendente'
            const parcsProd = estoqueGlobal[p.id] ?? []

            return (
              <div key={p.id} style={{ ...s.linha, background: pendente ? '#FFFDE7' : alterado ? '#FFFBEB' : '#fff' }}>
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
                  <input type="text" inputMode="decimal"
                    value={preco}
                    onChange={e => handlePreco(p.id, e.target.value)}
                    placeholder="0,00"
                    style={{ ...s.inputTabela, borderColor: pendente ? '#FCD34D' : alterado ? DOURADO : CINZA_BORDA }} />
                </div>
                <div style={{ width:100 }}>
                  <input type="text" inputMode="numeric"
                    value={qtd}
                    onChange={e => handleQtd(p.id, e.target.value)}
                    placeholder="0"
                    style={{ ...s.inputTabela, borderColor: pendente ? '#FCD34D' : alterado ? DOURADO : CINZA_BORDA }} />
                </div>
                <div style={{ width:90, textAlign:'center' as const }}>
                  {pendente
                    ? <span style={{ ...s.pill, background:'#FEF3C7', color:'#92400E' }}>⏳ Pendente</span>
                    : item?.preco > 0 && item?.quantidade > 0
                      ? <span style={{ ...s.pill, background:'#22C55E20', color:VERDE }}>✅ Ativo</span>
                      : <span style={{ ...s.pill, background:'#F4F6FB', color:TEXTO_MEIO }}>○ Inativo</span>
                  }
                </div>
                {/* Popover parceiros — só mostra outros parceiros, não o atual */}
                <div style={{ width:80, textAlign:'center' as const, position:'relative' }}>
                  <button onClick={() => setPopover(popover===p.id ? null : p.id)}
                    style={{ ...s.btnParceiros, background: parcsProd.length>0?'#EEF2FF':'#F4F6FB', color: parcsProd.length>0?AZUL:TEXTO_MEIO }}>
                    🏪 {parcsProd.length}
                  </button>
                  {popover === p.id && (
                    <div style={s.popover}>
                      <div style={s.popoverTit}>Todos os parceiros com estoque</div>
                      {parcsProd.length === 0
                        ? <div style={{ fontSize:12, color:TEXTO_MEIO }}>Nenhum parceiro.</div>
                        : parcsProd.map((pc, i) => (
                          <div key={i} style={s.popoverItem}>
                            <span style={{ flex:1, fontSize:12, fontWeight:600, color: pc.id===parcId?AZUL:TEXTO }}>{pc.nome}</span>
                            <span style={{ fontSize:12, fontWeight:800, color: i===0?VERDE:TEXTO }}>{formatBRL(pc.preco)}{i===0&&' ★'}</span>
                            <span style={{ fontSize:11, color: pc.quantidade<=5?LARANJA:TEXTO_MEIO, marginLeft:6 }}>{pc.quantidade}un</span>
                            {pc.status==='pendente' && <span style={{ fontSize:10, color:'#92400E', marginLeft:4 }}>⏳</span>}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:16 },
  cabecalho: { display:'flex', alignItems:'flex-start', justifyContent:'space-between' },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  sub: { fontSize:13, color:TEXTO_MEIO, marginTop:2 },
  btnSalvar: { background:AZUL, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
  alertaPendente: { display:'flex', alignItems:'center', justifyContent:'space-between', background:'#FFFBEB', border:'1.5px solid #FCD34D', borderRadius:10, padding:'12px 16px', fontSize:13, fontWeight:600, color:'#92400E' },
  btnAprovar: { background:VERDE, color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
  parceirosAbas: { display:'flex', gap:8, flexWrap:'wrap' as const },
  aba: { padding:'8px 16px', borderRadius:20, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit' },
  abaAtiva: { background:AZUL, color:'#fff', borderColor:AZUL },
  busca: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, background:'#fff', outline:'none', fontFamily:'inherit', color:TEXTO },
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
  btnParceiros: { border:'none', borderRadius:8, padding:'5px 8px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  popover: { position:'absolute', top:'calc(100% + 4px)', right:0, minWidth:240, background:'#fff', borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,0.15)', padding:'12px', zIndex:50, border:`1px solid ${CINZA_BORDA}` },
  popoverTit: { fontSize:11, fontWeight:800, color:TEXTO_MEIO, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:8 },
  popoverItem: { display:'flex', alignItems:'center', padding:'5px 0', borderBottom:`1px solid ${CINZA_BORDA}` },
}
