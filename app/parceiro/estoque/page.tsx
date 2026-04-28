'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

const CAT_ICONS: Record<string,string> = {
  bebidas:'🍺', conveniencia:'🏪', mercearia:'🛒', churrasco:'🥩',
  tabacaria:'🚬', bomboniere:'🍬', petiscos:'🍿', terere:'🧉',
  padaria:'🥖', farmacia:'💊', pet_shop:'🐾', material_construcao:'🔨',
  alimentos:'🥗', higiene:'🧴', limpeza:'🧹', outros:'📦',
}
const CAT_COR: Record<string,string> = {
  bebidas:'#2563EB', conveniencia:'#7C3AED', mercearia:'#16A34A', churrasco:'#DC2626',
  tabacaria:'#92400E', bomboniere:'#D97706', petiscos:'#EA580C', terere:'#059669',
  padaria:'#CA8A04', farmacia:'#0891B2', pet_shop:'#7C3AED', material_construcao:'#64748B',
  alimentos:'#16A34A', higiene:'#0891B2', limpeza:'#0891B2', outros:'#64748B',
}

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
  const [errMsg, setErrMsg]       = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('parceiros').select('id, categorias').eq('usuario_id', user.id).single()
    if (!p) return
    setParcId(p.id)

    // Filtra produtos pelas categorias do parceiro
    const cats: string[] = p.categorias ?? []
    let query = supabase.from('produtos').select('*').eq('ativo', true)
    if (cats.length > 0) query = query.in('categoria', cats)
    const { data: prods } = await query.then(r => ({
      ...r,
      data: r.data?.sort((a: any, b: any) => {
        const catDiff = a.categoria.localeCompare(b.categoria)
        return catDiff !== 0 ? catDiff : a.nome.localeCompare(b.nome)
      })
    }))
    setProdutos(prods ?? [])
    const { data: est } = await supabase.from('estoque').select('id, produto_id, preco, quantidade').eq('parceiro_id', p.id)
    const map: Record<string, any> = {}
    ;(est ?? []).forEach((e: any) => { map[e.produto_id] = e })
    setEstoque(map)
    setLoading(false)
  }

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
    return val ? val.toFixed(2).replace('.', ',') : ''
  }

  function getQtd(prodId: string) {
    const val = alterados[prodId]?.quantidade ?? estoque[prodId]?.quantidade ?? 0
    return val || ''
  }

  async function salvarTudo() {
    const keys = Object.keys(alterados)
    if (keys.length === 0) return
    setSalvando(true); setErrMsg('')
    const res  = await fetch('/api/estoque', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alterados }),
    })
    const data = await res.json()
    setSalvando(false)
    if (!res.ok || data.erro) {
      setErrMsg('❌ Erro ao salvar. Tente novamente.')
    } else {
      setAlterados({})
      setSalvoMsg('✅ Enviado para aprovação do Admin!')
      carregar()
    }
    setTimeout(() => { setSalvoMsg(''); setErrMsg('') }, 4000)
  }

  const qtdAlterados = Object.keys(alterados).length
  const filtrados    = produtos.filter(p => {
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtro === 'com_estoque') {
      const preco = alterados[p.id]?.preco ?? estoque[p.id]?.preco ?? 0
      const qtd   = alterados[p.id]?.quantidade ?? estoque[p.id]?.quantidade ?? 0
      return preco > 0 || qtd > 0
    }
    return true
  })

  // Agrupa por categoria
  const grupos: Record<string, any[]> = {}
  filtrados.forEach(p => {
    if (!grupos[p.categoria]) grupos[p.categoria] = []
    grupos[p.categoria].push(p)
  })

  return (
    <div style={s.wrap}>
      {/* Cabeçalho */}
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Meu estoque</h1>
          <p style={s.sub}>Produtos do seu ramo de atividade · Preencha preço e quantidade para aparecer na Vitrine</p>
        </div>
        <button onClick={salvarTudo} disabled={salvando || qtdAlterados===0}
          style={{ ...s.btnSalvar, opacity: qtdAlterados===0 ? 0.45 : 1 }}>
          {salvando ? '⏳ Salvando...' : qtdAlterados>0 ? `💾 Salvar (${qtdAlterados})` : '💾 Salvar'}
        </button>
      </div>

      {/* Mensagens */}
      {salvoMsg && <div style={s.msgSucesso}>{salvoMsg}</div>}
      {errMsg   && <div style={s.msgErro}>{errMsg}</div>}

      {/* Aviso */}
      <div style={s.aviso}>
        ℹ️ Foto, nome e categoria são controlados pelo Admin. Preencha apenas <strong>preço</strong> e <strong>quantidade</strong>.
        Produtos com qualquer campo zerado não aparecem na vitrine.
      </div>

      {/* Barra de filtros */}
      <div style={s.filtroBar}>
        <input style={s.busca} placeholder="🔍  Buscar produto..."
          value={busca} onChange={e => setBusca(e.target.value)} />
        <button onClick={() => setFiltro('todos')}
          style={{ ...s.filtroBtn, ...(filtro==='todos'?s.filtroBtnAtivo:{}) }}>Todos</button>
        <button onClick={() => setFiltro('com_estoque')}
          style={{ ...s.filtroBtn, ...(filtro==='com_estoque'?s.filtroBtnAtivo:{}) }}>Com estoque</button>
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.planilha}>
          {/* Header fixo */}
          <div style={s.header}>
            <div style={{ width: 50 }} />
            <div style={{ flex: 3, paddingLeft: 8 }}>PRODUTO</div>
            <div style={s.hCol}>UNID</div>
            <div style={s.hColEdit}>PREÇO (R$)</div>
            <div style={s.hColEdit}>QUANTIDADE</div>
            <div style={s.hCol}>STATUS</div>
          </div>

          {/* Linhas agrupadas por categoria */}
          {Object.entries(grupos).map(([cat, prods]) => (
            <div key={cat}>
              {/* Separador de categoria */}
              <div style={{ ...s.catRow, borderLeft: `4px solid ${CAT_COR[cat] ?? '#64748B'}` }}>
                {CAT_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                <span style={s.catCount}>{prods.length} produto{prods.length !== 1 ? 's' : ''}</span>
              </div>

              {prods.map((p, idx) => {
                const preco    = getPreco(p.id)
                const qtd      = getQtd(p.id)
                const alterado = alterados[p.id] !== undefined
                const precoNum = alterados[p.id]?.preco ?? estoque[p.id]?.preco ?? 0
                const qtdNum   = alterados[p.id]?.quantidade ?? estoque[p.id]?.quantidade ?? 0
                const ativo    = precoNum > 0 && qtdNum > 0

                return (
                  <div key={p.id} style={{
                    ...s.row,
                    background: alterado ? '#FFFDE7' : idx % 2 === 0 ? '#fff' : '#F8FAFC',
                  }}>
                    {/* Miniatura */}
                    <div style={s.cellFoto}>
                      {p.imagem_url
                        ? <img src={p.imagem_url} alt={p.nome} style={s.thumb} />
                        : <div style={s.thumbPlaceholder}>
                          <img src="/logo.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.4 }} />
                        </div>}
                    </div>

                    {/* Nome */}
                    <div style={{ flex: 3, padding: '0 8px' }}>
                      <div style={s.prodNome}>{p.nome}</div>
                    </div>

                    {/* Unidade */}
                    <div style={s.cell}>{p.unidade_medida}</div>

                    {/* Preço */}
                    <div style={s.cellEdit}>
                      <input
                        type="text" inputMode="decimal"
                        value={preco}
                        onChange={e => handlePreco(p.id, e.target.value)}
                        placeholder="0,00"
                        style={{ ...s.cellInput, borderColor: alterado ? DOURADO : '#D1D5DB' }}
                      />
                    </div>

                    {/* Quantidade */}
                    <div style={s.cellEdit}>
                      <input
                        type="text" inputMode="numeric"
                        value={qtd}
                        onChange={e => handleQtd(p.id, e.target.value)}
                        placeholder="0"
                        style={{
                          ...s.cellInput,
                          borderColor: alterado ? DOURADO : '#D1D5DB',
                          color: qtdNum === 0 ? '#9CA3AF' : qtdNum <= 5 ? LARANJA : VERDE,
                          fontWeight: qtdNum > 0 ? 800 : 400,
                        }}
                      />
                    </div>

                    {/* Status */}
                    <div style={s.cellStatus}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                        background: ativo ? '#DCFCE7' : '#F1F5F9',
                        color: ativo ? '#15803D' : '#94A3B8',
                      }}>
                        {ativo ? '✅ Ativo' : '○'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {filtrados.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center' as const, color: TEXTO_MEIO }}>
              Nenhum produto encontrado.
            </div>
          )}
        </div>
      )}

      {/* Botão flutuante */}
      {qtdAlterados > 0 && (
        <div style={s.float}>
          <button onClick={salvarTudo} disabled={salvando} style={s.btnFloat}>
            {salvando ? '⏳ Salvando...' : `💾 Salvar ${qtdAlterados} alteração(ões)`}
          </button>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:          { display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 80 },
  cabecalho:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  titulo:        { fontSize: 22, fontWeight: 800, color: '#1A2340', margin: 0 },
  sub:           { fontSize: 13, color: '#64748B', marginTop: 4 },
  btnSalvar:     { background: AZUL, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
  msgSucesso:    { background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#15803D' },
  msgErro:       { background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#DC2626' },
  aviso:         { background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1D4ED8' },
  filtroBar:     { display: 'flex', gap: 8, alignItems: 'center' },
  busca:         { flex: 1, border: '1px solid #D1D5DB', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#1A2340' },
  filtroBtn:     { padding: '8px 14px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748B', fontFamily: 'inherit' },
  filtroBtnAtivo:{ background: AZUL, color: '#fff', borderColor: AZUL },
  loading:       { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:       { width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(27,47,94,0.15)', borderTopColor: AZUL, display: 'block' },
  planilha:      { background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  header:        { display: 'flex', alignItems: 'center', background: '#1E293B', padding: '0 0 0 0', borderBottom: '2px solid #334155', height: 38 },
  hCol:          { width: 70, textAlign: 'center' as const, fontSize: 10, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.07em', textTransform: 'uppercase' as const },
  hColEdit:      { width: 130, textAlign: 'center' as const, fontSize: 10, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.07em', textTransform: 'uppercase' as const },
  catRow:        { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#F1F5F9', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #E2E8F0' },
  catCount:      { marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#94A3B8' },
  row:           { display: 'flex', alignItems: 'center', borderBottom: '1px solid #E2E8F0', minHeight: 48, transition: 'background 0.15s' },
  cellFoto:      { width: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' },
  thumb:         { width: 38, height: 38, borderRadius: 4, objectFit: 'cover' as const },
  thumbPlaceholder:{ width: 38, height: 38, borderRadius: 4, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  prodNome:      { fontSize: 13, fontWeight: 700, color: '#1A2340' },
  cell:          { width: 70, textAlign: 'center' as const, fontSize: 12, color: '#64748B', fontWeight: 600 },
  cellEdit:      { width: 130, padding: '4px 6px' },
  cellInput:     { width: '100%', border: '1.5px solid', borderRadius: 4, padding: '6px 8px', fontSize: 13, fontWeight: 700, color: '#1A2340', background: '#FAFBFE', outline: 'none', fontFamily: 'inherit', textAlign: 'center' as const },
  cellStatus:    { width: 70, textAlign: 'center' as const },
  float:         { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 50 },
  btnFloat:      { background: AZUL, color: '#fff', border: 'none', borderRadius: 30, padding: '13px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(27,47,94,0.35)' },
}
