'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

const CATEGORIAS = ['alimentos','bebidas','higiene','limpeza','farmacia','outros']
const CAT_ICONS: Record<string,string> = { alimentos:'🥗', bebidas:'🥤', higiene:'🧴', limpeza:'🧹', farmacia:'💊', outros:'📦' }

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState<any[]>([])
  const [modal, setModal]       = useState(false)
  const [nome, setNome]         = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('bebidas')
  const [unidade, setUnidade]   = useState('un')
  const [foto, setFoto]         = useState<File|null>(null)
  const [fotoNome, setFotoNome] = useState('')
  const [erro, setErro]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [filtroCat, setFiltroCat] = useState('todos')
  const [busca, setBusca]       = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('produtos')
      .select('*').order('nome')
    setProdutos(data ?? [])
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome || !foto) return setErro('Nome e foto são obrigatórios.')
    setLoading(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    const ext  = foto.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('produtos').upload(path, foto, { upsert: true })
    if (upErr) { setLoading(false); return setErro('Erro no upload da foto.') }
    const { data: url } = supabase.storage.from('produtos').getPublicUrl(path)

    const { error } = await supabase.from('produtos').insert({
      nome: nome.trim(), descricao: descricao.trim(), categoria,
      unidade_medida: unidade, imagem_url: url.publicUrl,
      ativo: true, criado_por: user?.id,
    })
    setLoading(false)
    if (error) return setErro('Erro ao salvar produto.')
    setModal(false); setNome(''); setDescricao(''); setFoto(null); setFotoNome('')
    carregar()
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('produtos').update({ ativo: !ativo }).eq('id', id)
    carregar()
  }

  const filtrados = produtos.filter(p => {
    if (filtroCat !== 'todos' && p.categoria !== filtroCat) return false
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Produtos</h1>
        <button onClick={() => setModal(true)} style={s.btnNovo}>+ Novo produto</button>
      </div>

      {/* Filtros */}
      <div style={s.filtros}>
        <input style={s.busca} placeholder="🔍  Buscar produto…" value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={s.cats}>
          <button onClick={() => setFiltroCat('todos')} style={{ ...s.catBtn, ...(filtroCat==='todos' ? s.catAtivo : {}) }}>Todos</button>
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setFiltroCat(c)}
              style={{ ...s.catBtn, ...(filtroCat===c ? s.catAtivo : {}) }}>
              {CAT_ICONS[c]} {c}
            </button>
          ))}
        </div>
      </div>

      <div style={s.grid}>
        {filtrados.map(p => (
          <div key={p.id} style={{ ...s.card, opacity: p.ativo ? 1 : 0.55 }}>
            <div style={s.fotoWrap}>
              {p.imagem_url
                ? <img src={p.imagem_url} alt={p.nome} style={s.foto} />
                : <div style={s.fotoPlaceholder}>{CAT_ICONS[p.categoria]}</div>
              }
              <span style={s.catTag}>{CAT_ICONS[p.categoria]} {p.categoria}</span>
            </div>
            <div style={s.cardBody}>
              <div style={s.cardNome}>{p.nome}</div>
              {p.descricao && <div style={s.cardDesc}>{p.descricao}</div>}
              <div style={s.cardMeta}>
                <span>{p.unidade_medida}</span>
                <span style={{ ...s.pillStatus, background: p.ativo ? '#22C55E20' : '#EF444420', color: p.ativo ? VERDE : VERMELHO }}>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <button onClick={() => toggleAtivo(p.id, p.ativo)}
                style={{ ...s.btnToggle, color: p.ativo ? VERMELHO : VERDE }}>
                {p.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal} className="anim-fadeUp">
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>Novo produto</h2>
              <button onClick={() => setModal(false)} style={s.fechar}>✕</button>
            </div>
            <form onSubmit={salvar} style={s.form}>
              <div style={s.campo}>
                <label style={s.label}>Nome do produto *</label>
                <input style={s.input} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Coca-Cola Lata 350ml" required />
              </div>
              <div style={s.campo}>
                <label style={s.label}>Descrição</label>
                <textarea style={{ ...s.input, resize:'none', height:72 }} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional…" />
              </div>
              <div style={s.grid2}>
                <div style={s.campo}>
                  <label style={s.label}>Categoria *</label>
                  <select style={s.input} value={categoria} onChange={e => setCategoria(e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
                  </select>
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Unidade</label>
                  <select style={s.input} value={unidade} onChange={e => setUnidade(e.target.value)}>
                    {['un','kg','g','L','ml','cx','pct','par'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.campo}>
                <label style={s.label}>Foto do produto *</label>
                <label style={s.uploadLabel}>
                  <input type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if(f){setFoto(f);setFotoNome(f.name)} }} />
                  🖼️ {fotoNome || 'Selecionar imagem'}
                </label>
              </div>
              {erro && <p style={s.erro}>{erro}</p>}
              <div style={s.acoes}>
                <button type="button" onClick={() => setModal(false)} style={s.btnCancelar}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ ...s.btnSalvar, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Salvando…' : 'Adicionar produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:20 },
  cabecalho: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  btnNovo: { background:AZUL, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  filtros: { display:'flex', flexDirection:'column', gap:12 },
  busca: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, background:'#fff', outline:'none', fontFamily:'inherit', color:TEXTO, width:'100%' },
  cats: { display:'flex', gap:8, flexWrap:'wrap' as const },
  catBtn: { padding:'6px 14px', borderRadius:20, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit', textTransform:'capitalize' as const },
  catAtivo: { background:AZUL, color:'#fff', borderColor:AZUL },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:16 },
  card: { background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column' },
  fotoWrap: { position:'relative', height:150, background:'#F4F6FB', overflow:'hidden' },
  foto: { width:'100%', height:'100%', objectFit:'cover' },
  fotoPlaceholder: { display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:48 },
  catTag: { position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, textTransform:'capitalize' as const },
  cardBody: { padding:'14px', display:'flex', flexDirection:'column', gap:8, flex:1 },
  cardNome: { fontSize:14, fontWeight:800, color:TEXTO },
  cardDesc: { fontSize:12, color:TEXTO_MEIO, lineHeight:1.4 },
  cardMeta: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  pillStatus: { fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20 },
  btnToggle: { background:'none', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, padding:0 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal: { background:'#fff', borderRadius:20, padding:'28px 24px', width:'100%', maxWidth:480, display:'flex', flexDirection:'column', gap:20 },
  modalTop: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  modalTitulo: { fontSize:18, fontWeight:800, color:TEXTO },
  fechar: { background:'none', border:'none', fontSize:20, cursor:'pointer', color:TEXTO_MEIO },
  form: { display:'flex', flexDirection:'column', gap:16 },
  campo: { display:'flex', flexDirection:'column', gap:5 },
  label: { fontSize:12, fontWeight:700, color:TEXTO },
  input: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'11px 13px', fontSize:14, color:TEXTO, background:'#FAFBFE', outline:'none', fontFamily:'inherit', width:'100%' },
  uploadLabel: { padding:'11px 13px', border:`1.5px dashed ${CINZA_BORDA}`, borderRadius:10, fontSize:13, color:TEXTO_MEIO, cursor:'pointer', textAlign:'center' as const, fontWeight:600 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  erro: { fontSize:13, color:'#EF4444', fontWeight:600, background:'#FFF1F1', borderRadius:10, padding:'10px 14px', border:'1px solid #FEE2E2' },
  acoes: { display:'flex', justifyContent:'flex-end', gap:12 },
  btnCancelar: { padding:'11px 18px', borderRadius:10, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', color:TEXTO_MEIO, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSalvar: { padding:'11px 20px', borderRadius:10, background:AZUL, color:'#fff', border:'none', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
}
