'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

const CATEGORIAS: { slug: string; nome: string; cor: string; svg: string }[] = [
  {
    slug: 'bebidas', nome: 'Bebidas', cor: '#2563EB',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="8" width="24" height="40" rx="4" fill="#DBEAFE" stroke="#2563EB" stroke-width="2.5"/>
      <rect x="20" y="8" width="24" height="12" rx="4" fill="#2563EB"/>
      <path d="M26 28 Q32 24 38 28 Q32 32 26 28Z" fill="#2563EB" opacity="0.3"/>
      <rect x="14" y="16" width="6" height="28" rx="3" fill="#93C5FD" stroke="#2563EB" stroke-width="1.5"/>
      <ellipse cx="32" cy="52" rx="12" ry="3" fill="#2563EB" opacity="0.15"/>
    </svg>`
  },
  {
    slug: 'conveniencia', nome: 'Conveniência', cor: '#7C3AED',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="22" width="44" height="32" rx="3" fill="#EDE9FE" stroke="#7C3AED" stroke-width="2.5"/>
      <path d="M10 28 L32 14 L54 28" fill="#7C3AED"/>
      <rect x="24" y="36" width="16" height="18" rx="2" fill="#7C3AED" opacity="0.4"/>
      <rect x="14" y="32" width="10" height="10" rx="2" fill="#7C3AED" opacity="0.6"/>
      <rect x="40" y="32" width="10" height="10" rx="2" fill="#7C3AED" opacity="0.6"/>
    </svg>`
  },
  {
    slug: 'mercearia', nome: 'Mercearia', cor: '#16A34A',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 18 L16 46 L48 46 L52 18 Z" fill="#DCFCE7" stroke="#16A34A" stroke-width="2.5"/>
      <path d="M8 18 L56 18" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="22" cy="12" r="4" fill="#16A34A"/>
      <circle cx="42" cy="12" r="4" fill="#16A34A"/>
      <path d="M18 12 L22 18 M42 12 L46 18" stroke="#16A34A" stroke-width="2"/>
      <rect x="26" y="28" width="12" height="10" rx="2" fill="#16A34A" opacity="0.4"/>
    </svg>`
  },
  {
    slug: 'churrasco', nome: 'Churrasco', cor: '#DC2626',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 40 Q20 28 32 32 Q44 36 54 24" stroke="#DC2626" stroke-width="3" stroke-linecap="round" fill="none"/>
      <rect x="28" y="10" width="8" height="36" rx="4" fill="#FEE2E2" stroke="#DC2626" stroke-width="2"/>
      <ellipse cx="32" cy="28" rx="10" ry="6" fill="#DC2626" opacity="0.3"/>
      <circle cx="16" cy="48" r="6" fill="#FCA5A5" stroke="#DC2626" stroke-width="2"/>
      <circle cx="32" cy="52" r="6" fill="#FCA5A5" stroke="#DC2626" stroke-width="2"/>
      <circle cx="48" cy="48" r="6" fill="#FCA5A5" stroke="#DC2626" stroke-width="2"/>
    </svg>`
  },
  {
    slug: 'tabacaria', nome: 'Tabacaria', cor: '#92400E',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="28" width="36" height="10" rx="5" fill="#FEF3C7" stroke="#92400E" stroke-width="2.5"/>
      <rect x="46" y="28" width="10" height="10" rx="2" fill="#92400E" opacity="0.4"/>
      <path d="M48 22 Q52 18 50 14 Q54 16 54 22" stroke="#92400E" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M42 20 Q46 16 44 12 Q48 14 48 20" stroke="#92400E" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    slug: 'bomboniere', nome: 'Bomboniere', cor: '#D97706',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="28" width="40" height="26" rx="4" fill="#FEF3C7" stroke="#D97706" stroke-width="2.5"/>
      <rect x="12" y="20" width="40" height="12" rx="4" fill="#D97706" opacity="0.3"/>
      <path d="M32 10 Q36 16 32 20 Q28 16 32 10Z" fill="#D97706"/>
      <circle cx="22" cy="40" r="5" fill="#D97706" opacity="0.5"/>
      <circle cx="32" cy="40" r="5" fill="#D97706" opacity="0.7"/>
      <circle cx="42" cy="40" r="5" fill="#D97706" opacity="0.5"/>
    </svg>`
  },
  {
    slug: 'petiscos', nome: 'Petiscos', cor: '#EA580C',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 48 L22 20 L32 16 L42 20 L48 48 Z" fill="#FFEDD5" stroke="#EA580C" stroke-width="2.5"/>
      <path d="M16 48 L48 48" stroke="#EA580C" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M20 38 Q32 32 44 38" stroke="#EA580C" stroke-width="2" fill="none"/>
      <path d="M22 28 Q32 22 42 28" stroke="#EA580C" stroke-width="2" fill="none" opacity="0.5"/>
      <circle cx="32" cy="16" r="4" fill="#EA580C"/>
    </svg>`
  },
  {
    slug: 'terere', nome: 'Tereré', cor: '#059669',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 14 L18 52 L46 52 L42 14 Z" fill="#D1FAE5" stroke="#059669" stroke-width="2.5"/>
      <rect x="26" y="6" width="12" height="10" rx="3" fill="#059669" opacity="0.4"/>
      <rect x="29" y="4" width="6" height="50" rx="3" fill="#059669"/>
      <path d="M20 30 Q32 24 44 30" stroke="#059669" stroke-width="2" fill="none" opacity="0.5"/>
    </svg>`
  },
  {
    slug: 'padaria', nome: 'Padaria', cor: '#CA8A04',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="36" rx="22" ry="16" fill="#FEF9C3" stroke="#CA8A04" stroke-width="2.5"/>
      <path d="M10 36 Q20 20 32 18 Q44 20 54 36" fill="#CA8A04" opacity="0.2"/>
      <path d="M16 34 Q24 26 32 24 Q40 26 48 34" stroke="#CA8A04" stroke-width="2" fill="none"/>
      <path d="M20 40 Q32 32 44 40" stroke="#CA8A04" stroke-width="1.5" fill="none" opacity="0.6"/>
    </svg>`
  },
  {
    slug: 'farmacia', nome: 'Farmácia', cor: '#0891B2',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="12" width="40" height="40" rx="8" fill="#E0F2FE" stroke="#0891B2" stroke-width="2.5"/>
      <rect x="28" y="18" width="8" height="28" rx="4" fill="#0891B2"/>
      <rect x="18" y="28" width="28" height="8" rx="4" fill="#0891B2"/>
    </svg>`
  },
  {
    slug: 'pet_shop', nome: 'Pet Shop', cor: '#7C3AED',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="38" rx="18" ry="16" fill="#EDE9FE" stroke="#7C3AED" stroke-width="2.5"/>
      <circle cx="20" cy="22" r="6" fill="#EDE9FE" stroke="#7C3AED" stroke-width="2"/>
      <circle cx="44" cy="22" r="6" fill="#EDE9FE" stroke="#7C3AED" stroke-width="2"/>
      <circle cx="26" cy="40" r="3" fill="#7C3AED" opacity="0.5"/>
      <circle cx="38" cy="40" r="3" fill="#7C3AED" opacity="0.5"/>
      <path d="M28 46 Q32 50 36 46" stroke="#7C3AED" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`
  },
  {
    slug: 'material_construcao', nome: 'Construção', cor: '#64748B',
    svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="40" width="48" height="14" rx="3" fill="#E2E8F0" stroke="#64748B" stroke-width="2.5"/>
      <rect x="14" y="28" width="36" height="14" rx="3" fill="#CBD5E1" stroke="#64748B" stroke-width="2"/>
      <rect x="20" y="18" width="24" height="12" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="2"/>
      <path d="M28 10 L36 10 L40 18 L24 18 Z" fill="#64748B"/>
    </svg>`
  },
]

export default function ParceiroEstoque() {
  const [catAtiva, setCatAtiva]   = useState<string | null>(null)
  const [produtos, setProdutos]   = useState<any[]>([])
  const [estoque, setEstoque]     = useState<Record<string, { id: string; preco: number; quantidade: number }>>({})
  const [parcId, setParcId]       = useState('')
  const [catsParceiro, setCatsParceiro] = useState<string[]>([])
  const [alterados, setAlterados] = useState<Record<string, { preco: number; quantidade: number }>>({})
  const [loading, setLoading]     = useState(true)
  const [loadingCat, setLoadingCat] = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [salvoMsg, setSalvoMsg]   = useState('')
  const [errMsg, setErrMsg]       = useState('')
  // Contadores por categoria (produtos com estoque ativo)
  const [ativos, setAtivos]       = useState<Record<string, number>>({})

  useEffect(() => { carregarParceiro() }, [])

  async function carregarParceiro() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('parceiros').select('id, categorias').eq('usuario_id', user.id).single()
    if (!p) return
    setParcId(p.id)
    const cats: string[] = p.categorias ?? []
    setCatsParceiro(cats)

    // Carregar estoque para calcular contadores
    const { data: est } = await supabase.from('estoque')
      .select('id, produto_id, preco, quantidade, produtos(categoria)')
      .eq('parceiro_id', p.id)

    const map: Record<string, any> = {}
    const contadores: Record<string, number> = {}
    ;(est ?? []).forEach((e: any) => {
      map[e.produto_id] = e
      if (e.preco > 0 && e.quantidade > 0) {
        const cat = e.produtos?.categoria ?? ''
        contadores[cat] = (contadores[cat] ?? 0) + 1
      }
    })
    setEstoque(map)
    setAtivos(contadores)
    setLoading(false)
  }

  async function entrarCategoria(slug: string) {
    setLoadingCat(true)
    setCatAtiva(slug)
    setAlterados({})

    const { data: prods } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .eq('categoria', slug)
      .order('nome')
    setProdutos(prods ?? [])
    setLoadingCat(false)
  }

  async function salvarEVoltar() {
    const keys = Object.keys(alterados)
    if (keys.length > 0) {
      setSalvando(true)
      const res = await fetch('/api/estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alterados }),
      })
      const data = await res.json()
      setSalvando(false)
      if (!res.ok || data.erro) {
        setErrMsg('❌ Erro ao salvar. Tente novamente.')
        setTimeout(() => setErrMsg(''), 3000)
        return
      }
    }
    // Recarrega contadores e volta para grade
    await carregarParceiro()
    setCatAtiva(null)
    setProdutos([])
    setAlterados({})
    setSalvoMsg('✅ Salvo com sucesso!')
    setTimeout(() => setSalvoMsg(''), 3000)
  }

  function handlePreco(prodId: string, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    const valor  = digits ? parseInt(digits) / 100 : 0
    const atual  = estoque[prodId] ?? { id: '', preco: 0, quantidade: 0 }
    const prev   = alterados[prodId] ?? { preco: atual.preco, quantidade: atual.quantidade }
    setAlterados(a => ({ ...a, [prodId]: { ...prev, preco: valor } }))
  }

  function handleQtd(prodId: string, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    const valor  = digits ? parseInt(digits) : 0
    const atual  = estoque[prodId] ?? { id: '', preco: 0, quantidade: 0 }
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

  const qtdAlterados   = Object.keys(alterados).length
  const catsDisponiveis = CATEGORIAS.filter(c => catsParceiro.includes(c.slug))

  // ── TELA: GRADE DE CATEGORIAS ──────────────────────────────────
  if (!catAtiva) return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Meu estoque</h1>
          <p style={s.sub}>Selecione uma categoria para preencher preço e quantidade</p>
        </div>
      </div>

      {salvoMsg && <div style={s.msgSucesso}>{salvoMsg}</div>}
      {errMsg   && <div style={s.msgErro}>{errMsg}</div>}

      <div style={s.aviso}>
        ℹ️ Preencha <strong>preço</strong> e <strong>quantidade</strong> para cada produto aparecer na Vitrine.
        Quantidade zero = produto invisível na Vitrine.
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.catGrid}>
          {catsDisponiveis.map(cat => {
            const qtdAtivos = ativos[cat.slug] ?? 0
            return (
              <button key={cat.slug} onClick={() => entrarCategoria(cat.slug)}
                style={{ ...s.catCard, borderColor: cat.cor + '50' }}>
                {/* Indicador de produtos ativos */}
                {qtdAtivos > 0 && (
                  <div style={{ ...s.catBadge, background: cat.cor }}>
                    {qtdAtivos} ✓
                  </div>
                )}
                <div style={{ ...s.catIconWrap, background: cat.cor + '18' }}
                  dangerouslySetInnerHTML={{ __html: cat.svg }} />
                <span style={{ ...s.catNome, color: cat.cor }}>{cat.nome}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── TELA: PRODUTOS DA CATEGORIA ────────────────────────────────
  const catInfo = CATEGORIAS.find(c => c.slug === catAtiva)!

  return (
    <div style={s.wrap} className="anim-fadeIn">

      {/* Header da categoria */}
      <div style={{ ...s.catHeader, background: catInfo.cor }}>
        <button onClick={salvarEVoltar} disabled={salvando} style={s.btnVoltar}>
          {salvando ? '⏳' : '←'} {qtdAlterados > 0 ? `Salvar e voltar` : 'Voltar'}
        </button>
        <div style={s.catHeaderInfo}>
          <div style={s.catHeaderIcon} dangerouslySetInnerHTML={{ __html: catInfo.svg }} />
          <div>
            <div style={s.catHeaderNome}>{catInfo.nome}</div>
            <div style={s.catHeaderSub}>{produtos.length} produto{produtos.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        {qtdAlterados > 0 && (
          <div style={s.alteradosBadge}>{qtdAlterados} alterado{qtdAlterados !== 1 ? 's' : ''}</div>
        )}
      </div>

      {errMsg   && <div style={{ ...s.msgErro,   margin: '8px 0 0' }}>{errMsg}</div>}

      {loadingCat ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.planilha}>
          {/* Header tabela */}
          <div style={s.tableHeader}>
            <div style={{ width: 50 }} />
            <div style={{ flex: 1, paddingLeft: 8, fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>PRODUTO</div>
            <div style={s.hCol}>UNID</div>
            <div style={s.hColEdit}>PREÇO (R$)</div>
            <div style={s.hColEdit}>QUANTIDADE</div>
            <div style={s.hCol}>STATUS</div>
          </div>

          {produtos.map((p, idx) => {
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
                        <img src="/logo.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.35 }} />
                      </div>
                  }
                </div>

                {/* Nome */}
                <div style={{ flex: 1, padding: '0 8px' }}>
                  <div style={s.prodNome}>{p.nome}</div>
                </div>

                {/* Unidade */}
                <div style={s.cell}>{p.unidade_medida}</div>

                {/* Preço */}
                <div style={s.cellEdit}>
                  <input
                    type="text" inputMode="decimal"
                    value={getPreco(p.id)}
                    onChange={e => handlePreco(p.id, e.target.value)}
                    placeholder="0,00"
                    style={{ ...s.cellInput, borderColor: alterado ? DOURADO : '#D1D5DB' }}
                  />
                </div>

                {/* Quantidade */}
                <div style={s.cellEdit}>
                  <input
                    type="text" inputMode="numeric"
                    value={getQtd(p.id)}
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
                    {ativo ? '✅' : '○'}
                  </span>
                </div>
              </div>
            )
          })}

          {produtos.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center' as const, color: TEXTO_MEIO }}>
              Nenhum produto nesta categoria.
            </div>
          )}
        </div>
      )}

      {/* Botão flutuante salvar */}
      <div style={s.float}>
        <button onClick={salvarEVoltar} disabled={salvando} style={{ ...s.btnFloat, background: catInfo.cor }}>
          {salvando
            ? '⏳ Salvando...'
            : qtdAlterados > 0
              ? `💾 Salvar ${qtdAlterados} alteração${qtdAlterados !== 1 ? 'ões' : ''} e voltar`
              : '← Voltar para categorias'
          }
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:         { display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 80 },
  cabecalho:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  titulo:       { fontSize: 22, fontWeight: 800, color: '#1A2340', margin: 0 },
  sub:          { fontSize: 13, color: '#64748B', marginTop: 4 },
  msgSucesso:   { background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#15803D' },
  msgErro:      { background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#DC2626' },
  aviso:        { background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1D4ED8' },
  loading:      { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:      { width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(27,47,94,0.15)', borderTopColor: AZUL, display: 'block' },
  // Grade categorias
  catGrid:      { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  catCard:      { position: 'relative', background: '#fff', borderRadius: 16, padding: '20px 10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, border: '1.5px solid', cursor: 'pointer', boxShadow: '0 2px 8px rgba(27,47,94,0.06)', fontFamily: 'inherit', transition: 'transform 0.15s' },
  catBadge:     { position: 'absolute', top: 8, right: 8, color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20 },
  catIconWrap:  { width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 },
  catNome:      { fontSize: 12, fontWeight: 800, textAlign: 'center' as const },
  // Header categoria
  catHeader:    { borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const },
  btnVoltar:    { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  catHeaderInfo:{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 },
  catHeaderIcon:{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', padding: 8, flexShrink: 0 },
  catHeaderNome:{ color: '#fff', fontSize: 17, fontWeight: 900 },
  catHeaderSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 },
  alteradosBadge:{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20 },
  // Tabela
  planilha:     { background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tableHeader:  { display: 'flex', alignItems: 'center', background: '#1E293B', height: 38 },
  hCol:         { width: 70, textAlign: 'center' as const, fontSize: 10, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.07em', textTransform: 'uppercase' as const },
  hColEdit:     { width: 130, textAlign: 'center' as const, fontSize: 10, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.07em', textTransform: 'uppercase' as const },
  row:          { display: 'flex', alignItems: 'center', borderBottom: '1px solid #E2E8F0', minHeight: 52 },
  cellFoto:     { width: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' },
  thumb:        { width: 38, height: 38, borderRadius: 4, objectFit: 'cover' as const },
  thumbPlaceholder: { width: 38, height: 38, borderRadius: 4, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  prodNome:     { fontSize: 13, fontWeight: 700, color: '#1A2340', lineHeight: 1.3 },
  cell:         { width: 70, textAlign: 'center' as const, fontSize: 12, color: '#64748B', fontWeight: 600 },
  cellEdit:     { width: 130, padding: '4px 6px' },
  cellInput:    { width: '100%', border: '1.5px solid', borderRadius: 4, padding: '6px 8px', fontSize: 13, fontWeight: 700, color: '#1A2340', background: '#FAFBFE', outline: 'none', fontFamily: 'inherit', textAlign: 'center' as const },
  cellStatus:   { width: 70, textAlign: 'center' as const },
  float:        { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 50 },
  btnFloat:     { color: '#fff', border: 'none', borderRadius: 30, padding: '13px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' as const },
}
