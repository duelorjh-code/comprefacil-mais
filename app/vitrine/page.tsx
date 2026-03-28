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

const CAT_ICONS: Record<string, string> = { alimentos:'🥗', bebidas:'🥤', higiene:'🧴', limpeza:'🧹', farmacia:'💊', outros:'📦' }
const CATEGORIAS = ['todos','alimentos','bebidas','higiene','limpeza','farmacia','outros']

export default function Vitrine() {
  const router = useRouter()
  const [produtos, setProdutos]   = useState<ProdutoCard[]>([])
  const [carrinho, setCarrinho]   = useState<any[]>([])
  const [coords, setCoords]       = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading]     = useState(true)
  const [locErro, setLocErro]     = useState(false)
  const [filtro, setFiltro]       = useState('todos')
  const [busca, setBusca]         = useState('')
  const [modalConv, setModalConv] = useState(false)
  const [usuario, setUsuario]     = useState<any>(null)

  useEffect(() => {
    // Carrega sessão
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const { data: p } = await supabase.from('perfis').select('nome').eq('id', user.id).single()
      setUsuario(p)
    })

    // Carrinho do localStorage
    try {
      const raw = localStorage.getItem('cfm_carrinho')
      if (raw) setCarrinho(JSON.parse(raw))
    } catch {}

    // GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { setLocErro(true); setCoords({ lat: -20.75, lng: -51.7 }); },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      setCoords({ lat: -20.75, lng: -51.7 })
    }
  }, [])

  useEffect(() => {
    if (coords) carregarProdutos()
  }, [coords])

  async function carregarProdutos() {
    setLoading(true)
    // Busca estoque ativo com produto e parceiro
    const { data } = await supabase
      .from('estoque')
      .select(`
        id, preco, quantidade,
        produtos ( id, nome, categoria, imagem_url, unidade_medida, ativo ),
        parceiros ( id, lat, lng, ativo )
      `)
      .eq('ativo', true)
      .gt('quantidade', 0)
      .eq('status_aprovacao', 'aprovado')
      .eq('produtos.ativo', true)
      .eq('parceiros.ativo', true)

    if (!data || !coords) { setLoading(false); return }

    // Busca promoções ativas
    const { data: proms } = await supabase
      .from('promocoes')
      .select('produto_id, parceiro_id')
      .eq('ativo', true)
    const promSet = new Set((proms ?? []).map((p: any) => `${p.produto_id}|${p.parceiro_id}`))

    // Monta cards com taxas calculadas
    const cards: ProdutoCard[] = (data as any[])
      .filter(e => e.produtos && e.parceiros)
      .map(e => {
        const dist = distanciaKm(coords.lat, coords.lng, e.parceiros.lat, e.parceiros.lng)
        const taxa = calcTaxaEntrega(dist)
        const sla  = calcSlaMinutos(dist)
        const conv = calcConveniencia(e.preco)
        return {
          estoqueId:   e.id,
          produtoId:   e.produtos.id,
          nome:        e.produtos.nome,
          categoria:   e.produtos.categoria,
          imagem_url:  e.produtos.imagem_url,
          unidade_medida: e.produtos.unidade_medida,
          preco:       e.preco,
          isPromocional: promSet.has(`${e.produtos.id}|${e.parceiros.id}`),
          parceiroId:  e.parceiros.id,
          parceiroLat: e.parceiros.lat,
          parceiroLng: e.parceiros.lng,
          distancia:   dist,
          taxaEntrega: taxa,
          slaMin:      sla,
          taxaConv:    conv,
        }
      })
      .sort((a, b) => a.distancia - b.distancia)

    setProdutos(cards)
    setLoading(false)
  }

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

  const totalCarrinho = carrinho.reduce((a, i) => a + i.quantidade, 0)

  const filtrados = produtos.filter(p => {
    if (filtro !== 'todos' && p.categoria !== filtro) return false
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  return (
    <div style={s.page}>
      {/* Topbar */}
      <header style={s.topbar}>
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        <div style={s.topRight}>
          {usuario && <span style={s.saudacao}>Olá, {usuario.nome?.split(' ')[0]} 👋</span>}
          <button onClick={() => router.push('/carrinho')} style={s.btnCarrinho}>
            🛒 {totalCarrinho > 0 && <span style={s.badge}>{totalCarrinho}</span>}
          </button>
        </div>
      </header>

      {/* Busca */}
      <div style={s.buscaWrap}>
        <input style={s.busca} placeholder="🔍  Buscar produto…" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {/* Categorias */}
      <div style={s.catScroll}>
        {CATEGORIAS.map(c => (
          <button key={c} onClick={() => setFiltro(c)}
            style={{ ...s.catBtn, ...(filtro===c ? s.catAtivo : {}) }}>
            {c !== 'todos' && CAT_ICONS[c]} {c === 'todos' ? 'Todos' : c}
          </button>
        ))}
      </div>

      {locErro && (
        <div style={s.locAviso}>📍 Localização aproximada. Para melhores resultados, permita o acesso.</div>
      )}

      {/* Produtos */}
      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : filtrados.length === 0 ? (
        <div style={s.vazio}>
          <div style={{ fontSize:48 }}>🔍</div>
          <p>Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {filtrados.map(p => {
            const qtd = qtdNoCarrinho(p.estoqueId)
            return (
              <div key={p.estoqueId} style={s.card}>
                {/* Selo promoção */}
                {p.isPromocional && (
                  <div style={s.promoTag}>🏷️ Preço promocional</div>
                )}

                {/* Foto */}
                <div style={s.fotoWrap}>
                  {p.imagem_url
                    ? <img src={p.imagem_url} alt={p.nome} style={s.foto} />
                    : <div style={s.fotoPlaceholder}>{CAT_ICONS[p.categoria]}</div>
                  }
                </div>

                {/* Info */}
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

                  {/* Botão adicionar */}
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

      {/* Bottom nav */}
      <nav style={s.bottomNav}>
        {[
          { icon:'🏠', label:'Início',   href:'/vitrine' },
          { icon:'🛒', label:'Carrinho', href:'/carrinho', badge: totalCarrinho },
          { icon:'📦', label:'Pedido',   href:'/pedido' },
          { icon:'👤', label:'Perfil',   href:'/perfil' },
        ].map(item => (
          <button key={item.href} onClick={() => router.push(item.href)} style={s.navBtn}>
            <span style={{ position:'relative' }}>
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
  page: { minHeight:'100vh', background:'#F4F6FB', fontFamily:"'Nunito', sans-serif", paddingBottom:72 },
  topbar: { background:AZUL, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 },
  logo: { height:30, objectFit:'contain' },
  topRight: { display:'flex', alignItems:'center', gap:10 },
  saudacao: { color:'rgba(255,255,255,0.8)', fontSize:13, fontWeight:600 },
  btnCarrinho: { background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', padding:'7px 12px', borderRadius:10, fontSize:15, cursor:'pointer', fontFamily:'inherit', position:'relative', fontWeight:700 },
  badge: { position:'absolute', top:-4, right:-4, background:DOURADO, color:'#fff', fontSize:9, fontWeight:800, padding:'1px 5px', borderRadius:10, minWidth:16, textAlign:'center' as const },
  buscaWrap: { padding:'12px 16px 8px' },
  busca: { width:'100%', border:'none', borderRadius:12, padding:'12px 16px', fontSize:14, background:'#fff', boxShadow:'0 1px 8px rgba(27,47,94,0.08)', outline:'none', fontFamily:'inherit', color:TEXTO },
  catScroll: { display:'flex', gap:8, overflowX:'auto', padding:'0 16px 12px', scrollbarWidth:'none' },
  catBtn: { flexShrink:0, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit', textTransform:'capitalize' as const, whiteSpace:'nowrap' },
  catAtivo: { background:AZUL, color:'#fff', borderColor:AZUL },
  locAviso: { margin:'0 16px 8px', fontSize:12, color:TEXTO_MEIO, background:'#FFFBEB', borderRadius:8, padding:'8px 12px' },
  loading: { display:'flex', justifyContent:'center', padding:80 },
  spinner: { width:36, height:36, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  vazio: { textAlign:'center' as const, padding:'60px 20px', color:TEXTO_MEIO, display:'flex', flexDirection:'column', alignItems:'center', gap:12 },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:12, padding:'0 16px' },
  card: { background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 10px rgba(27,47,94,0.07)', display:'flex', flexDirection:'column' },
  promoTag: { background:DOURADO, color:'#fff', fontSize:10, fontWeight:800, padding:'4px 10px', textAlign:'center' as const },
  fotoWrap: { height:130, overflow:'hidden' },
  foto: { width:'100%', height:'100%', objectFit:'cover' },
  fotoPlaceholder: { display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:40, background:'#F4F6FB' },
  cardBody: { padding:'12px', display:'flex', flexDirection:'column', gap:8, flex:1 },
  cardNome: { fontSize:13, fontWeight:800, color:TEXTO, lineHeight:1.3 },
  cardPreco: { fontSize:17, fontWeight:900, color:AZUL },
  taxas: { display:'flex', flexDirection:'column', gap:4 },
  taxaItem: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  taxaL: { fontSize:10, color:TEXTO_MEIO, fontWeight:600 },
  taxaV: { fontSize:10, fontWeight:700, color:TEXTO },
  convBtn: { background:'none', border:'none', fontSize:10, color:DOURADO, fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:0, textAlign:'left' as const },
  btnAdicionar: { width:'100%', padding:'10px', background:AZUL, color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', marginTop:'auto' },
  qtdControle: { display:'flex', alignItems:'center', justifyContent:'space-between', background:'#F4F6FB', borderRadius:10, padding:'4px', marginTop:'auto' },
  qtdBtn: { width:32, height:32, borderRadius:8, border:'none', background:AZUL, color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
  qtdNum: { fontSize:15, fontWeight:800, color:AZUL },
  bottomNav: { position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #E2E8F0', display:'flex', padding:'6px 0', boxShadow:'0 -4px 16px rgba(0,0,0,0.06)', zIndex:40 },
  navBtn: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px', fontFamily:'inherit', fontSize:20, position:'relative' },
  navBadge: { position:'absolute', top:-2, right:0, background:DOURADO, color:'#fff', fontSize:9, fontWeight:800, padding:'1px 4px', borderRadius:10 },
  navLabel: { fontSize:10, color:TEXTO_MEIO, fontWeight:700 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  modalConv: { background:'#fff', borderRadius:'20px 20px 0 0', padding:'28px 20px', width:'100%', maxWidth:480, display:'flex', flexDirection:'column', gap:16 },
  modalTitulo: { fontSize:17, fontWeight:800, color:TEXTO },
  modalTexto: { fontSize:13, color:TEXTO_MEIO, lineHeight:1.6 },
  tabelaConv: { display:'flex', flexDirection:'column', gap:0, borderRadius:10, overflow:'hidden', border:`1px solid ${CINZA_BORDA}` },
  convRow: { display:'flex', justifyContent:'space-between', padding:'10px 14px', borderBottom:`1px solid ${CINZA_BORDA}` },
  convFaixa: { fontSize:13, color:TEXTO },
  convTaxa: { fontSize:13, fontWeight:800, color:AZUL },
  btnEntendi: { padding:'14px', background:AZUL, color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
}
