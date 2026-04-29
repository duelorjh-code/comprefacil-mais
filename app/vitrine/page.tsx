'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL, calcTaxaEntrega, calcSlaMinutos, calcConveniencia, distanciaKm } from '@/lib/constants'

interface ProdutoCard {
  estoqueId: string
  produtoId: string
  nome: string
  categoria: string
  imagem_url: string
  unidade_medida: string
  preco: number
  isPromocional: boolean
  parceiroId: string
  parceiroLat: number
  parceiroLng: number
  distancia: number
  taxaEntrega: number
  slaMin: number
  taxaConv: number
}

// Categorias com SVGs inline
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

export default function Vitrine() {
  const router = useRouter()
  const [todos, setTodos]         = useState<ProdutoCard[]>([])
  const [carrinho, setCarrinho]   = useState<any[]>([])
  const [coords, setCoords]       = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [locErro, setLocErro]     = useState(false)
  const [catAtiva, setCatAtiva]   = useState<string | null>(null)
  const [busca, setBusca]         = useState('')
  const [modalConv, setModalConv] = useState(false)
  const [usuario, setUsuario]     = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfis').select('nome').eq('id', user.id).single()
      setUsuario(p)
    })
    try {
      const raw = localStorage.getItem('cfm_carrinho')
      if (raw) setCarrinho(JSON.parse(raw))
    } catch {}
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { setLocErro(true); setCoords({ lat: -20.75, lng: -51.7 }) },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      setCoords({ lat: -20.75, lng: -51.7 })
    }
    carregarProdutos()
  }, [])

  async function carregarProdutos() {
    setLoading(true)
    const res  = await fetch('/api/vitrine')
    const json = await res.json()
    const data = json.data
    if (!data) { setLoading(false); return }

    const { data: proms } = await supabase
      .from('promocoes').select('produto_id, parceiro_id').eq('ativo', true)
    const promSet = new Set((proms ?? []).map((p: any) => `${p.produto_id}|${p.parceiro_id}`))

    const c = coords ?? { lat: -20.75, lng: -51.7 }
    const cards: ProdutoCard[] = (data as any[])
      .filter(e => e.produtos && e.parceiros)
      .map(e => {
        const dist = distanciaKm(c.lat, c.lng, e.parceiros.lat ?? -20.75, e.parceiros.lng ?? -51.7)
        return {
          estoqueId:    e.id,
          produtoId:    e.produtos.id,
          nome:         e.produtos.nome,
          categoria:    e.produtos.categoria,
          imagem_url:   e.produtos.imagem_url,
          unidade_medida: e.produtos.unidade_medida,
          preco:        e.preco,
          isPromocional: promSet.has(`${e.produtos.id}|${e.parceiros.id}`),
          parceiroId:   e.parceiros.id,
          parceiroLat:  e.parceiros.lat,
          parceiroLng:  e.parceiros.lng,
          distancia:    dist,
          taxaEntrega:  calcTaxaEntrega(dist),
          slaMin:       calcSlaMinutos(dist),
          taxaConv:     calcConveniencia(e.preco),
        }
      })
      .sort((a, b) => a.distancia - b.distancia)

    setTodos(cards)
    setLoading(false)
  }

  // Categorias que têm produtos disponíveis
  const catsDisponiveis = CATEGORIAS.filter(c =>
    todos.some(p => p.categoria === c.slug)
  )

  // Produtos filtrados pela categoria ativa + busca
  const filtrados = todos.filter(p => {
    if (catAtiva && p.categoria !== catAtiva) return false
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  function qtdNoCarrinho(estoqueId: string) {
    return carrinho.find(i => i.estoqueId === estoqueId)?.quantidade ?? 0
  }

  function adicionarAoCarrinho(p: ProdutoCard) {
    const novo = carrinho.find(i => i.estoqueId === p.estoqueId)
      ? carrinho.map(i => i.estoqueId === p.estoqueId ? { ...i, quantidade: i.quantidade + 1 } : i)
      : [...carrinho, { estoqueId: p.estoqueId, produtoId: p.produtoId, nome: p.nome, imagem_url: p.imagem_url, preco: p.preco, parceiroId: p.parceiroId, parceiroLat: p.parceiroLat, parceiroLng: p.parceiroLng, quantidade: 1 }]
    setCarrinho(novo)
    localStorage.setItem('cfm_carrinho', JSON.stringify(novo))
  }

  function removerDoCarrinho(estoqueId: string) {
    const novo = carrinho.map(i => i.estoqueId === estoqueId ? { ...i, quantidade: i.quantidade - 1 } : i).filter(i => i.quantidade > 0)
    setCarrinho(novo)
    localStorage.setItem('cfm_carrinho', JSON.stringify(novo))
  }

  const totalCarrinho  = carrinho.reduce((a, i) => a + i.quantidade, 0)
  const valorCarrinho  = carrinho.reduce((a, i) => a + i.preco * i.quantidade, 0)
  const catInfo        = catAtiva ? CATEGORIAS.find(c => c.slug === catAtiva) : null

  return (
    <div style={s.page}>

      {/* Topbar */}
      <header style={s.topbar}>
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        <div style={s.topRight}>
          {usuario && <span style={s.saudacao}>Olá, {usuario.nome?.split(' ')[0]} 👋</span>}
          <button onClick={() => router.push('/carrinho')} style={s.btnCarrinho}>
            🛒
            {totalCarrinho > 0 && <span style={s.badge}>{totalCarrinho}</span>}
            {valorCarrinho > 0 && (
              <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.9 }}>
                {formatBRL(valorCarrinho)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── TELA INICIAL: grade de categorias ── */}
      {!catAtiva && !busca && (
        <>
          {/* Hero */}
          <div style={s.hero}>
            <div style={s.heroTexto}>
              <h2 style={s.heroTitulo}>O que você precisa hoje?</h2>
              <p style={s.heroSub}>Entregamos na sua porta em minutos</p>
            </div>
          </div>

          {/* Busca global */}
          <div style={s.buscaWrap}>
            <input style={s.busca} placeholder="🔍  Buscar produto em todas as categorias…"
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          {locErro && (
            <div style={s.locAviso}>📍 Localização aproximada. Para melhores resultados, permita o acesso.</div>
          )}

          {loading ? (
            <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
          ) : (
            <div style={s.catGrid}>
              {catsDisponiveis.map(cat => (
                <button key={cat.slug} onClick={() => setCatAtiva(cat.slug)}
                  style={{ ...s.catCard, borderColor: cat.cor + '40' }}>
                  <div style={{ ...s.catIconWrap, background: cat.cor + '15' }}
                    dangerouslySetInnerHTML={{ __html: cat.svg }} />
                  <span style={{ ...s.catNome, color: cat.cor }}>{cat.nome}</span>
                  <span style={{ ...s.catQtd, background: cat.cor + '15', color: cat.cor }}>
                    {todos.filter(p => p.categoria === cat.slug).length} itens
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TELA DE PRODUTOS (categoria selecionada ou busca) ── */}
      {(catAtiva || busca) && (
        <>
          {/* Header da categoria */}
          <div style={{ ...s.catHeader, background: catInfo ? catInfo.cor : AZUL }}>
            <button onClick={() => { setCatAtiva(null); setBusca('') }} style={s.btnVoltar}>
              ← Voltar
            </button>
            <div style={s.catHeaderContent}>
              {catInfo && (
                <div style={s.catHeaderIcon}
                  dangerouslySetInnerHTML={{ __html: catInfo.svg }} />
              )}
              <div>
                <div style={s.catHeaderNome}>{catInfo?.nome ?? 'Busca'}</div>
                <div style={s.catHeaderQtd}>{filtrados.length} produto{filtrados.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>

          {/* Busca dentro da categoria */}
          <div style={s.buscaWrap}>
            <input style={s.busca}
              placeholder={catInfo ? `🔍  Buscar em ${catInfo.nome}…` : '🔍  Buscar produto…'}
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          {locErro && (
            <div style={s.locAviso}>📍 Localização aproximada.</div>
          )}

          {loading ? (
            <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
          ) : filtrados.length === 0 ? (
            <div style={s.vazio}>
              <div style={{ fontSize: 48 }}>🔍</div>
              <p>Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div style={s.grid}>
              {filtrados.map(p => {
                const qtd = qtdNoCarrinho(p.estoqueId)
                return (
                  <div key={p.estoqueId} style={s.card}>
                    {p.isPromocional && (
                      <div style={s.promoTag}>🏷️ Preço promocional</div>
                    )}
                    <div style={s.fotoWrap}>
                      {p.imagem_url
                        ? <img src={p.imagem_url} alt={p.nome} style={s.foto} />
                        : (
                          <div style={s.fotoPlaceholder}>
                            <img src="/logo.png" alt="CompreFácil+" style={s.logoPlaceholder} />
                            <span style={s.semImagemTxt}>Imagem não disponível</span>
                          </div>
                        )
                      }
                    </div>
                    <div style={s.cardBody}>
                      <div style={s.cardNome}>{p.nome}</div>
                      <div style={s.cardPreco}>{formatBRL(p.preco)}</div>
                      <div style={s.taxas}>
                        <div style={s.taxaItem}>
                          <span style={s.taxaL}>🛵 Entrega</span>
                          <span style={s.taxaV}>{formatBRL(p.taxaEntrega)} · {p.distancia.toFixed(1)}km</span>
                        </div>
                        <div style={s.taxaItem}>
                          <span style={s.taxaL}>⏱ Tempo</span>
                          <span style={s.taxaV}>~{p.slaMin} min</span>
                        </div>
                        <div style={s.taxaItem}>
                          <button onClick={() => setModalConv(true)} style={s.convBtn}>
                            + Taxa de conveniência ⓘ
                          </button>
                        </div>
                      </div>
                      {qtd === 0 ? (
                        <button onClick={() => adicionarAoCarrinho(p)} style={s.btnAdicionar}>
                          Adicionar
                        </button>
                      ) : (
                        <div style={s.qtdControle}>
                          <button onClick={() => removerDoCarrinho(p.estoqueId)} style={s.qtdBtn}>−</button>
                          <span style={s.qtdNum}>{qtd}</span>
                          <button onClick={() => adicionarAoCarrinho(p)} style={s.qtdBtn}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Bottom nav */}
      <nav style={s.bottomNav}>
        {[
          { icon: '🏠', label: 'Início',   href: '/vitrine' },
          { icon: '🛒', label: 'Carrinho', href: '/carrinho', badge: totalCarrinho },
          { icon: '👤', label: 'Pedido',   href: '/perfil' },
        ].map(item => (
          <button key={item.href} onClick={() => router.push(item.href)} style={s.navBtn}>
            <span style={{ position: 'relative' }}>
              {item.icon}
              {item.badge && item.badge > 0 && <span style={s.navBadge}>{item.badge}</span>}
            </span>
            <span style={s.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Modal conveniência */}
      {modalConv && (
        <div style={s.overlay} onClick={() => setModalConv(false)}>
          <div style={s.modalConv} className="anim-fadeUp" onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitulo}>💡 O que é a taxa de conveniência?</h3>
            <p style={s.modalTexto}>
              É uma pequena taxa que garante a operação da plataforma — incluindo suporte, tecnologia e segurança da sua compra.
            </p>
            <div style={s.tabelaConv}>
              {[['Até R$ 59,99','R$ 5,00'],['R$ 60 – R$ 119,99','R$ 7,00'],['R$ 120 – R$ 239,99','R$ 9,00'],['R$ 240 – R$ 479,99','R$ 11,00'],['R$ 480+','R$ 13,00']].map(([faixa, taxa]) => (
                <div key={faixa} style={s.convRow}>
                  <span style={s.convFaixa}>{faixa}</span>
                  <span style={s.convTaxa}>{taxa}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setModalConv(false)} style={s.btnEntendi}>Entendi</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:         { minHeight: '100vh', background: '#F4F6FB', fontFamily: "'Nunito', sans-serif", paddingBottom: 72 },
  topbar:       { background: AZUL, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 },
  logo:         { height: 30, objectFit: 'contain' },
  topRight:     { display: 'flex', alignItems: 'center', gap: 10 },
  saudacao:     { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600 },
  btnCarrinho:  { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '7px 12px', borderRadius: 10, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', position: 'relative', fontWeight: 700 },
  badge:        { position: 'absolute', top: -4, right: -4, background: DOURADO, color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center' as const },
  // Hero
  hero:         { background: `linear-gradient(135deg, ${AZUL} 0%, #2d4a8a 100%)`, padding: '24px 16px 28px', margin: 0 },
  heroTexto:    { textAlign: 'center' as const },
  heroTitulo:   { color: '#fff', fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: -0.5 },
  heroSub:      { color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: '6px 0 0', fontWeight: 600 },
  // Busca
  buscaWrap:    { padding: '12px 16px 8px' },
  busca:        { width: '100%', border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 14, background: '#fff', boxShadow: '0 1px 8px rgba(27,47,94,0.08)', outline: 'none', fontFamily: 'inherit', color: '#1A2340' },
  locAviso:     { margin: '0 16px 8px', fontSize: 12, color: TEXTO_MEIO, background: '#FFFBEB', borderRadius: 8, padding: '8px 12px' },
  loading:      { display: 'flex', justifyContent: 'center', padding: 80 },
  spinner:      { width: 36, height: 36, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  // Grade de categorias
  catGrid:      { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '8px 16px 24px' },
  catCard:      { background: '#fff', borderRadius: 16, padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px solid', cursor: 'pointer', boxShadow: '0 2px 8px rgba(27,47,94,0.06)', transition: 'transform 0.15s', fontFamily: 'inherit' },
  catIconWrap:  { width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 },
  catNome:      { fontSize: 12, fontWeight: 800, textAlign: 'center' as const },
  catQtd:       { fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20 },
  // Header categoria
  catHeader:    { padding: '16px', display: 'flex', alignItems: 'center', gap: 16 },
  btnVoltar:    { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  catHeaderContent: { display: 'flex', alignItems: 'center', gap: 12 },
  catHeaderIcon:{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', padding: 8, flexShrink: 0 },
  catHeaderNome:{ color: '#fff', fontSize: 18, fontWeight: 900 },
  catHeaderQtd: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 },
  // Produtos
  vazio:        { textAlign: 'center' as const, padding: '60px 20px', color: TEXTO_MEIO, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, padding: '0 16px' },
  card:         { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(27,47,94,0.07)', display: 'flex', flexDirection: 'column' },
  promoTag:     { background: DOURADO, color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 10px', textAlign: 'center' as const },
  fotoWrap:     { height: 130, overflow: 'hidden' },
  foto:         { width: '100%', height: '100%', objectFit: 'cover' },
  fotoPlaceholder:{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F4F6FB', gap: 6, padding: '12px' },
  logoPlaceholder:{ height: 36, objectFit: 'contain', opacity: 0.5 },
  semImagemTxt: { fontSize: 9, color: TEXTO_MEIO, fontWeight: 600, textAlign: 'center' as const },
  cardBody:     { padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  cardNome:     { fontSize: 13, fontWeight: 800, color: TEXTO, lineHeight: 1.3 },
  cardPreco:    { fontSize: 17, fontWeight: 900, color: AZUL },
  taxas:        { display: 'flex', flexDirection: 'column', gap: 4 },
  taxaItem:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  taxaL:        { fontSize: 10, color: TEXTO_MEIO, fontWeight: 600 },
  taxaV:        { fontSize: 10, fontWeight: 700, color: TEXTO },
  convBtn:      { background: 'none', border: 'none', fontSize: 10, color: DOURADO, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' as const },
  btnAdicionar: { width: '100%', padding: '10px', background: AZUL, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginTop: 'auto' },
  qtdControle:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F4F6FB', borderRadius: 10, padding: '4px', marginTop: 'auto' },
  qtdBtn:       { width: 32, height: 32, borderRadius: 8, border: 'none', background: AZUL, color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  qtdNum:       { fontSize: 15, fontWeight: 800, color: AZUL },
  bottomNav:    { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E2E8F0', display: 'flex', padding: '6px 0', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)', zIndex: 40 },
  navBtn:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontFamily: 'inherit', fontSize: 20, position: 'relative' },
  navBadge:     { position: 'absolute', top: -2, right: 0, background: DOURADO, color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 4px', borderRadius: 10 },
  navLabel:     { fontSize: 10, color: TEXTO_MEIO, fontWeight: 700 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalConv:    { background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 20px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitulo:  { fontSize: 17, fontWeight: 800, color: TEXTO },
  modalTexto:   { fontSize: 13, color: TEXTO_MEIO, lineHeight: 1.6 },
  tabelaConv:   { display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 10, overflow: 'hidden', border: `1px solid ${CINZA_BORDA}` },
  convRow:      { display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${CINZA_BORDA}` },
  convFaixa:    { fontSize: 13, color: TEXTO },
  convTaxa:     { fontSize: 13, fontWeight: 800, color: AZUL },
  btnEntendi:   { padding: '14px', background: AZUL, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
}
