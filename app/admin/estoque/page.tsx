'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const CAT_ICONS: Record<string,string> = { alimentos:'🥗', bebidas:'🥤', higiene:'🧴', limpeza:'🧹', farmacia:'💊', outros:'📦' }

export default function AdminEstoque() {
  const [parceiros, setParceiros]   = useState<any[]>([])
  const [parcId, setParcId]         = useState('')
  const [produtos, setProdutos]     = useState<any[]>([])
  const [estoque, setEstoque]       = useState<Record<string, { id:string, preco:number, quantidade:number }>>({})
  const [estoqueGlobal, setEstoqueGlobal] = useState<Record<string, any[]>>({})
  const [popover, setPopover]       = useState<string|null>(null)
  const [alterados, setAlterados]   = useState<Record<string, { preco:number, quantidade:number }>>({})
  const [loading, setLoading]       = useState(true)
  const [salvando, setSalvando]     = useState(false)
  const [busca, setBusca]           = useState('')

  useEffect(() => { carregarParceiros() }, [])
  useEffect(() => { if (parcId) carregarEstoque() }, [parcId])

  async function carregarParceiros() {
    const { data } = await supabase.from('parceiros').select('id, nome_fantasia').order('nome_fantasia')
    setParceiros(data ?? [])
    if (data && data.length > 0) setParcId(data[0].id)

    // Estoque global de todos os parceiros para o popover
    const { data: est } = await supabase
      .from('estoque')
      .select('produto_id, preco, quantidade, parceiros ( nome_fantasia )')
      .gt('quantidade', 0).gt('preco', 0)
    const map: Record<string, any[]> = {}
    ;(est ?? []).forEach((e: any) => {
      if (!map[e.produto_id]) map[e.produto_id] = []
      map[e.produto_id].push({ nome: e.parceiros?.nome_fantasia, preco: e.preco, quantidade: e.quantidade })
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
      .select('id, produto_id, preco, quantidade')
      .eq('parceiro_id', parcId)

    const map: Record<string, { id:string, preco:number, quantidade:number }> = {}
    ;(est ?? []).forEach((e: any) => { map[e.produto_id] = { id: e.id, preco: e.preco, quantidade: e.quantidade } })
    setEstoque(map)
    setLoading(false)
  }

  function atualizar(prodId: string, campo: 'preco'|'quantidade', valor: string) {
    const atual = estoque[prodId] ?? { id:'', preco:0, quantidade:0 }
    const prev  = alterados[prodId] ?? { preco: atual.preco, quantidade: atual.quantidade }
    setAlterados(a => ({
      ...a,
      [prodId]: { ...prev, [campo]: campo==='preco' ? parseFloat(valor)||0 : parseInt(valor)||0 }
    }))
  }

  function getValor(prodId: string, campo: 'preco'|'quantidade') {
    if (alterados[prodId] !== undefined) return alterados[prodId][campo]
    return estoque[prodId]?.[campo] ?? 0
  }

  async function salvarTudo() {
    if (Object.keys(alterados).length === 0) return
    setSalvando(true)
    await Promise.all(Object.entries(alterados).map(async ([prodId, vals]) => {
      const item = estoque[prodId]
      if (item?.id) {
        await supabase.from('estoque').update({ preco: vals.preco, quantidade: vals.quantidade }).eq('id', item.id)
      } else {
        const { data: novoEst } = await supabase.from('estoque').insert({
          parceiro_id: parcId, produto_id: prodId,
          preco: vals.preco, quantidade: vals.quantidade, ativo: true,
        }).select('id, produto_id, preco, quantidade').single()
        if (novoEst) setEstoque(prev => ({ ...prev, [prodId]: novoEst }))
      }
    }))
    setAlterados({})
    setSalvando(false)
    carregarEstoque()
  }

  const qtdAlterados = Object.keys(alterados).length
  const filtrados    = produtos.filter(p => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div style={s.wrap} className="anim-fadeIn">
      {/* Cabeçalho */}
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

      {/* Seletor de parceiro */}
      <div style={s.parceirosAbas}>
        {parceiros.map(p => (
          <button key={p.id} onClick={() => setParcId(p.id)}
            style={{ ...s.aba, ...(parcId===p.id ? s.abaAtiva : {}) }}>
            🏪 {p.nome_fantasia}
          </button>
        ))}
      </div>

      {/* Busca */}
      <input style={s.busca} placeholder="🔍  Buscar produto…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.tabelaWrap}>
          {/* Header */}
          <div style={s.thead}>
            <div style={{ width:52 }} />
            <div style={{ flex:3 }}>Produto</div>
            <div style={{ width:60, textAlign:'center' as const }}>Unid</div>
            <div style={{ width:110, textAlign:'center' as const }}>Preço (R$)</div>
            <div style={{ width:90, textAlign:'center' as const }}>Qtd</div>
            <div style={{ width:80, textAlign:'center' as const }}>Parceiros</div>
          </div>

          {/* Linhas */}
          {filtrados.map(p => {
            const preco    = getValor(p.id, 'preco')
            const qtd      = getValor(p.id, 'quantidade')
            const alterado = alterados[p.id] !== undefined
            const parcsProd = estoqueGlobal[p.id] ?? []

            return (
              <div key={p.id} style={{ ...s.linha, background: alterado ? '#FFFBEB' : '#fff' }}>
                {/* Foto */}
                <div style={{ width:52 }}>
                  {p.imagem_url
                    ? <img src={p.imagem_url} alt={p.nome} style={s.miniThumb} />
                    : <div style={s.miniPlaceholder}>{CAT_ICONS[p.categoria]}</div>
                  }
                </div>

                {/* Nome */}
                <div style={{ flex:3 }}>
                  <div style={s.linhaNome}>{p.nome}</div>
                  <div style={s.linhaCat}>{CAT_ICONS[p.categoria]} {p.categoria}</div>
                </div>

                {/* Unidade */}
                <div style={{ width:60, textAlign:'center' as const, fontSize:12, color:TEXTO_MEIO, fontWeight:600 }}>{p.unidade_medida}</div>

                {/* Preço */}
                <div style={{ width:110 }}>
                  <input type="number" min="0" step="0.01"
                    value={preco || ''}
                    onChange={e => atualizar(p.id, 'preco', e.target.value)}
                    placeholder="0,00"
                    style={{ ...s.inputTabela, borderColor: alterado ? DOURADO : CINZA_BORDA }} />
                </div>

                {/* Quantidade */}
                <div style={{ width:90 }}>
                  <input type="number" min="0" step="1"
                    value={qtd || ''}
                    onChange={e => atualizar(p.id, 'quantidade', e.target.value)}
                    placeholder="0"
                    style={{ ...s.inputTabela, borderColor: alterado ? DOURADO : CINZA_BORDA,
                      color: qtd===0 ? TEXTO_MEIO : qtd<=5 ? LARANJA : VERDE }} />
                </div>

                {/* Parceiros */}
                <div style={{ width:80, textAlign:'center' as const, position:'relative' }}>
                  <button onClick={() => setPopover(popover===p.id ? null : p.id)}
                    style={{ ...s.btnParceiros, background: parcsProd.length>0 ? '#EEF2FF' : '#F4F6FB',
                      color: parcsProd.length>0 ? AZUL : TEXTO_MEIO }}>
                    🏪 {parcsProd.length}
                  </button>

                  {popover === p.id && (
                    <div style={s.popover}>
                      <div style={s.popoverTit}>Parceiros com estoque</div>
                      {parcsProd.length === 0
                        ? <div style={{ fontSize:12, color:TEXTO_MEIO }}>Nenhum parceiro.</div>
                        : parcsProd.map((pc, i) => (
                          <div key={i} style={s.popoverItem}>
                            <span style={{ flex:1, fontSize:12, fontWeight:600, color:TEXTO }}>{pc.nome}</span>
                            <span style={{ fontSize:12, fontWeight:800, color: i===0?VERDE:TEXTO }}>{formatBRL(pc.preco)}{i===0&&' ★'}</span>
                            <span style={{ fontSize:11, color: pc.quantidade<=5?LARANJA:TEXTO_MEIO, marginLeft:6 }}>{pc.quantidade}un</span>
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
  btnSalvar: { background:AZUL, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit', transition:'opacity 0.2s' },
  parceirosAbas: { display:'flex', gap:8, flexWrap:'wrap' as const },
  aba: { padding:'8px 16px', borderRadius:20, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit' },
  abaAtiva: { background:AZUL, color:'#fff', borderColor:AZUL },
  busca: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, background:'#fff', outline:'none', fontFamily:'inherit', color:TEXTO },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:28, height:28, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  tabelaWrap: { background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', border:`1px solid ${CINZA_BORDA}` },
  thead: { display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'#F4F6FB', borderBottom:`1px solid ${CINZA_BORDA}`, fontSize:11, fontWeight:800, color:TEXTO_MEIO, textTransform:'uppercase' as const, letterSpacing:'0.05em' },
  linha: { display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:`1px solid ${CINZA_BORDA}`, transition:'background 0.2s' },
  miniThumb: { width:44, height:44, borderRadius:8, objectFit:'cover' },
  miniPlaceholder: { width:44, height:44, borderRadius:8, background:'#F4F6FB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 },
  linhaNome: { fontSize:13, fontWeight:700, color:TEXTO },
  linhaCat: { fontSize:11, color:TEXTO_MEIO, marginTop:2 },
  inputTabela: { width:'100%', border:'1.5px solid', borderRadius:8, padding:'7px 10px', fontSize:13, fontWeight:700, color:TEXTO, background:'#FAFBFE', outline:'none', fontFamily:'inherit', textAlign:'center' as const },
  btnParceiros: { border:'none', borderRadius:8, padding:'5px 8px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  popover: { position:'absolute', top:'calc(100% + 4px)', right:0, minWidth:220, background:'#fff', borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,0.15)', padding:'12px', zIndex:50, border:`1px solid ${CINZA_BORDA}` },
  popoverTit: { fontSize:11, fontWeight:800, color:TEXTO_MEIO, textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:8 },
  popoverItem: { display:'flex', alignItems:'center', padding:'5px 0', borderBottom:`1px solid ${CINZA_BORDA}` },
}
