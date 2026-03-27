'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

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

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('parceiros').select('id').eq('usuario_id', user.id).single()
    if (!p) return
    setParcId(p.id)

    // Todos os produtos do catálogo
    const { data: prods } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome')
    setProdutos(prods ?? [])

    // Estoque atual desse parceiro
    const { data: est } = await supabase.from('estoque')
      .select('id, produto_id, preco, quantidade')
      .eq('parceiro_id', p.id)

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
      } else if (vals.preco > 0 || vals.quantidade > 0) {
        const { data: novo } = await supabase.from('estoque').insert({
          parceiro_id: parcId, produto_id: prodId,
          preco: vals.preco, quantidade: vals.quantidade, ativo: true,
        }).select('id, produto_id, preco, quantidade').single()
        if (novo) setEstoque(prev => ({ ...prev, [prodId]: novo }))
      }
    }))
    setAlterados({})
    setSalvando(false)
    carregar()
  }

  const qtdAlterados = Object.keys(alterados).length

  const filtrados = produtos.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtro === 'com_estoque') {
      const preco = getValor(p.id, 'preco')
      const qtd   = getValor(p.id, 'quantidade')
      return preco > 0 || qtd > 0
    }
    return true
  })

  return (
    <div style={s.wrap} className="anim-fadeIn">
      {/* Cabeçalho */}
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

      {/* Aviso */}
      <div style={s.aviso}>
        📋 Foto, nome e categoria são controlados pelo Admin. Preencha apenas <strong>preço</strong> e <strong>quantidade</strong>. Produtos com preço ou quantidade zero não aparecem na vitrine.
      </div>

      {/* Filtros */}
      <div style={s.filtroRow}>
        <input style={s.busca} placeholder="🔍  Buscar produto…"
          value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={s.abas}>
          <button onClick={() => setFiltro('todos')}
            style={{ ...s.aba, ...(filtro==='todos' ? s.abaAtiva : {}) }}>
            Todos
          </button>
          <button onClick={() => setFiltro('com_estoque')}
            style={{ ...s.aba, ...(filtro==='com_estoque' ? s.abaAtiva : {}) }}>
            Com estoque
          </button>
        </div>
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.tabelaWrap}>
          {/* Header */}
          <div style={s.thead}>
            <div style={{ width:52 }} />
            <div style={{ flex:3 }}>Produto</div>
            <div style={{ width:60, textAlign:'center' as const }}>Unid</div>
            <div style={{ width:120, textAlign:'center' as const }}>Preço (R$)</div>
            <div style={{ width:100, textAlign:'center' as const }}>Quantidade</div>
            <div style={{ width:80, textAlign:'center' as const }}>Status</div>
          </div>

          {filtrados.length === 0 && (
            <div style={{ padding:40, textAlign:'center' as const, color:TEXTO_MEIO, fontSize:14 }}>
              Nenhum produto encontrado.
            </div>
          )}

          {filtrados.map(p => {
            const preco    = getValor(p.id, 'preco')
            const qtd      = getValor(p.id, 'quantidade')
            const alterado = alterados[p.id] !== undefined
            const ativo    = preco > 0 && qtd > 0

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
                <div style={{ width:60, textAlign:'center' as const, fontSize:12, color:TEXTO_MEIO, fontWeight:600 }}>
                  {p.unidade_medida}
                </div>

                {/* Preço */}
                <div style={{ width:120 }}>
                  <input type="number" min="0" step="0.01"
                    value={preco || ''}
                    onChange={e => atualizar(p.id, 'preco', e.target.value)}
                    placeholder="0,00"
                    style={{ ...s.inputTabela, borderColor: alterado ? DOURADO : CINZA_BORDA }} />
                </div>

                {/* Quantidade */}
                <div style={{ width:100 }}>
                  <input type="number" min="0" step="1"
                    value={qtd || ''}
                    onChange={e => atualizar(p.id, 'quantidade', e.target.value)}
                    placeholder="0"
                    style={{ ...s.inputTabela, borderColor: alterado ? DOURADO : CINZA_BORDA,
                      color: qtd===0 ? TEXTO_MEIO : qtd<=5 ? LARANJA : VERDE }} />
                </div>

                {/* Status */}
                <div style={{ width:80, textAlign:'center' as const }}>
                  <span style={{ ...s.pill, background: ativo?'#22C55E20':'#F4F6FB', color: ativo?VERDE:TEXTO_MEIO }}>
                    {ativo ? '✅ Ativo' : '○ Inativo'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Botão salvar flutuante quando há alterações */}
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
  btnSalvar: { background:AZUL, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit', transition:'opacity 0.2s' },
  aviso: { background:'#EEF2FF', borderRadius:10, padding:'12px 16px', fontSize:13, color:AZUL, border:`1px solid #C7D2FE` },
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
  inputTabela: { width:'100%', border:'1.5px solid', borderRadius:8, padding:'7px 10px', fontSize:13, fontWeight:700, color:TEXTO, background:'#FAFBFE', outline:'none', fontFamily:'inherit', textAlign:'center' as const },
  pill: { fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, whiteSpace:'nowrap' as const },
  floatSalvar: { position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:50 },
  btnSalvarFloat: { background:AZUL, color:'#fff', border:'none', borderRadius:30, padding:'14px 32px', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 20px rgba(27,47,94,0.3)' },
}
