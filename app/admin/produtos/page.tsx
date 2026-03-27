'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

const CATEGORIAS = ['alimentos','bebidas','higiene','limpeza','farmacia','outros']
const CAT_ICONS: Record<string,string> = { alimentos:'🥗', bebidas:'🥤', higiene:'🧴', limpeza:'🧹', farmacia:'💊', outros:'📦' }

interface ProdutoImport {
  nome: string
  descricao: string
  categoria: string
  unidade_medida: string
  arquivo_foto: string
  foto?: File
  status: 'pendente' | 'enviando' | 'ok' | 'erro'
  erro?: string
}

export default function AdminProdutos() {
  const [produtos, setProdutos]         = useState<any[]>([])
  const [modal, setModal]               = useState(false)
  const [modalImport, setModalImport]   = useState(false)
  const [importando, setImportando]     = useState(false)
  const [progresso, setProgresso]       = useState(0)
  const [itensImport, setItensImport]   = useState<ProdutoImport[]>([])
  const [fotosImport, setFotosImport]   = useState<File[]>([])
  const [nome, setNome]                 = useState('')
  const [descricao, setDescricao]       = useState('')
  const [categoria, setCategoria]       = useState('bebidas')
  const [unidade, setUnidade]           = useState('un')
  const [foto, setFoto]                 = useState<File|null>(null)
  const [fotoNome, setFotoNome]         = useState('')
  const [erro, setErro]                 = useState('')
  const [loading, setLoading]           = useState(false)
  const [filtroCat, setFiltroCat]       = useState('todos')
  const [busca, setBusca]               = useState('')
  const csvRef  = useRef<HTMLInputElement>(null)
  const fotosRef = useRef<HTMLInputElement>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('produtos').select('*').order('nome')
    setProdutos(data ?? [])
  }

  // ── Cadastro individual ──────────────────────────────────────
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

  // ── Import CSV ───────────────────────────────────────────────
  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      const header = lines[0].split(',').map(h => h.trim().replace(/"/g,''))
      const items: ProdutoImport[] = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g,''))
        const obj: any = {}
        header.forEach((h, i) => { obj[h] = vals[i] ?? '' })
        return { ...obj, status: 'pendente' }
      }).filter(i => i.nome)
      setItensImport(items)
    }
    reader.readAsText(file)
  }

  function handleFotosImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setFotosImport(files)
    // Associa as fotos aos itens pelo nome do arquivo
    setItensImport(prev => prev.map(item => {
      const foto = files.find(f => f.name === item.arquivo_foto)
      return { ...item, foto: foto ?? undefined }
    }))
  }

  async function executarImport() {
    if (itensImport.length === 0) return
    setImportando(true)
    setProgresso(0)
    const { data: { user } } = await supabase.auth.getUser()
    const total = itensImport.length

    for (let i = 0; i < total; i++) {
      const item = itensImport[i]
      setItensImport(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'enviando' } : it))

      try {
        let imagem_url = ''

        if (item.foto) {
          const ext  = item.foto.name.split('.').pop()
          const path = `${Date.now()}-${i}.${ext}`
          const { error: upErr } = await supabase.storage.from('produtos').upload(path, item.foto, { upsert: true })
          if (!upErr) {
            const { data: url } = supabase.storage.from('produtos').getPublicUrl(path)
            imagem_url = url.publicUrl
          }
        }

        const { error } = await supabase.from('produtos').insert({
          nome:           item.nome.trim(),
          descricao:      item.descricao?.trim() ?? '',
          categoria:      CATEGORIAS.includes(item.categoria) ? item.categoria : 'outros',
          unidade_medida: item.unidade_medida || 'un',
          imagem_url,
          ativo:          true,
          criado_por:     user?.id,
        })

        setItensImport(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: error ? 'erro' : 'ok', erro: error?.message } : it
        ))
      } catch (e: any) {
        setItensImport(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'erro', erro: e.message } : it
        ))
      }

      setProgresso(Math.round(((i + 1) / total) * 100))
    }

    setImportando(false)
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

  const okCount    = itensImport.filter(i => i.status === 'ok').length
  const erroCount  = itensImport.filter(i => i.status === 'erro').length

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Produtos <span style={s.count}>{produtos.length}</span></h1>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setModalImport(true)} style={s.btnImport}>📥 Importar CSV</button>
          <button onClick={() => setModal(true)} style={s.btnNovo}>+ Novo produto</button>
        </div>
      </div>

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
                <span style={{ fontSize:11, color:TEXTO_MEIO }}>{p.unidade_medida}</span>
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

      {/* Modal cadastro individual */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal} className="anim-fadeUp">
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>Novo produto</h2>
              <button onClick={() => setModal(false)} style={s.fechar}>✕</button>
            </div>
            <form onSubmit={salvar} style={s.form}>
              <div style={s.campo}>
                <label style={s.label}>Nome *</label>
                <input style={s.input} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Coca-Cola Lata 350ml" required />
              </div>
              <div style={s.campo}>
                <label style={s.label}>Descrição</label>
                <textarea style={{ ...s.input, resize:'none', height:64 }} value={descricao} onChange={e => setDescricao(e.target.value)} />
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
                <label style={s.label}>Foto *</label>
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
                  {loading ? 'Salvando…' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal importar CSV */}
      {modalImport && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && !importando && setModalImport(false)}>
          <div style={{ ...s.modal, maxWidth:600 }} className="anim-fadeUp">
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>Importar produtos via CSV</h2>
              {!importando && <button onClick={() => setModalImport(false)} style={s.fechar}>✕</button>}
            </div>

            {itensImport.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={s.instrucoes}>
                  <p style={{ fontWeight:700, marginBottom:8 }}>Como usar:</p>
                  <p>1. Baixe o modelo CSV abaixo</p>
                  <p>2. Preencha com seus produtos</p>
                  <p>3. Selecione as fotos e o CSV juntos</p>
                  <p>4. Clique em Importar</p>
                </div>

                <a href="data:text/csv;charset=utf-8,nome,descricao,categoria,unidade_medida,arquivo_foto%0Acoca-cola-lata-350ml,Coca-Cola lata 350ml,bebidas,un,coca-cola-lata-350ml.jpg"
                  download="modelo-produtos.csv" style={s.btnDownload}>
                  📄 Baixar modelo CSV
                </a>

                <div style={s.campo}>
                  <label style={s.label}>1. Selecione as fotos (múltiplas)</label>
                  <label style={s.uploadLabel}>
                    <input ref={fotosRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={handleFotosImport} />
                    🖼️ {fotosImport.length > 0 ? `✅ ${fotosImport.length} foto(s) selecionada(s)` : 'Selecionar fotos'}
                  </label>
                </div>

                <div style={s.campo}>
                  <label style={s.label}>2. Selecione o arquivo CSV</label>
                  <label style={s.uploadLabel}>
                    <input ref={csvRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleCSV} />
                    📋 Selecionar CSV
                  </label>
                </div>

                {fotosImport.length > 0 && itensImport.length > 0 && (
                  <button onClick={executarImport} style={{ ...s.btnSalvar, background: '#22C55E', marginTop: 8 }}>
                    ▶ Importar {itensImport.length} produtos com {fotosImport.length} fotos
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* Progresso */}
                {importando && (
                  <div style={s.progressoWrap}>
                    <div style={s.progressoBar}>
                      <div style={{ ...s.progressoFill, width: `${progresso}%` }} />
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color:AZUL }}>{progresso}%</span>
                  </div>
                )}

                {/* Resumo */}
                {!importando && okCount + erroCount === itensImport.length && (
                  <div style={{ ...s.instrucoes, background: okCount === itensImport.length ? '#22C55E15' : '#FFF1F1' }}>
                    ✅ {okCount} importados com sucesso {erroCount > 0 && `| ❌ ${erroCount} com erro`}
                  </div>
                )}

                {/* Lista */}
                <div style={s.listaImport}>
                  {itensImport.map((item, i) => (
                    <div key={i} style={s.itemImport}>
                      <span style={{ fontSize:16 }}>
                        {item.status === 'ok' ? '✅' : item.status === 'erro' ? '❌' : item.status === 'enviando' ? '⏳' : '○'}
                      </span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:TEXTO }}>{item.nome}</div>
                        <div style={{ fontSize:11, color:TEXTO_MEIO }}>{item.categoria} · {item.unidade_medida} {item.foto ? '📸' : '(sem foto)'}</div>
                        {item.erro && <div style={{ fontSize:11, color:VERMELHO }}>{item.erro}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ações */}
                {!importando && okCount + erroCount < itensImport.length && (
                  <button onClick={executarImport} style={{ ...s.btnSalvar, background: '#22C55E' }}>
                    ▶ Importar {itensImport.length} produtos
                  </button>
                )}
                {!importando && (
                  <button onClick={() => { setItensImport([]); setFotosImport([]); if(csvRef.current) csvRef.current.value=''; if(fotosRef.current) fotosRef.current.value='' }}
                    style={s.btnCancelar}>
                    {okCount + erroCount === itensImport.length ? 'Fechar' : 'Limpar e recomeçar'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:20 },
  cabecalho: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO, display:'flex', alignItems:'center', gap:8 },
  count: { fontSize:14, fontWeight:600, color:TEXTO_MEIO, background:'#F4F6FB', padding:'2px 10px', borderRadius:20 },
  btnImport: { background:'#EEF2FF', color:AZUL, border:`1.5px solid #C7D2FE`, borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
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
  modal: { background:'#fff', borderRadius:20, padding:'28px 24px', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:20 },
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
  instrucoes: { background:'#F4F6FB', borderRadius:10, padding:'14px', fontSize:13, color:TEXTO_MEIO, lineHeight:1.8 },
  btnDownload: { display:'block', padding:'11px', background:'#EEF2FF', color:AZUL, borderRadius:10, textAlign:'center' as const, fontSize:13, fontWeight:700, textDecoration:'none', border:`1.5px solid #C7D2FE` },
  progressoWrap: { display:'flex', alignItems:'center', gap:12 },
  progressoBar: { flex:1, height:8, background:'#F4F6FB', borderRadius:4, overflow:'hidden' },
  progressoFill: { height:'100%', background:AZUL, borderRadius:4, transition:'width 0.3s ease' },
  listaImport: { display:'flex', flexDirection:'column', gap:8, maxHeight:300, overflowY:'auto' },
  itemImport: { display:'flex', alignItems:'flex-start', gap:10, padding:'8px 12px', background:'#F4F6FB', borderRadius:8 },
}
