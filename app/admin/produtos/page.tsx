'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const CATEGORIAS_SISTEMA = [
  { slug: 'todos',              nome: 'Todos',          emoji: '📦' },
  { slug: 'bebidas',            nome: 'Bebidas',        emoji: '🍺' },
  { slug: 'conveniencia',       nome: 'Conveniência',   emoji: '🏪' },
  { slug: 'mercearia',          nome: 'Mercearia',      emoji: '🛒' },
  { slug: 'churrasco',          nome: 'Churrasco',      emoji: '🥩' },
  { slug: 'tabacaria',          nome: 'Tabacaria',      emoji: '🚬' },
  { slug: 'bomboniere',         nome: 'Bomboniere',     emoji: '🍬' },
  { slug: 'petiscos',           nome: 'Petiscos',       emoji: '🍿' },
  { slug: 'terere',             nome: 'Tereré',         emoji: '🧉' },
  { slug: 'padaria',            nome: 'Padaria',        emoji: '🥖' },
  { slug: 'farmacia',           nome: 'Farmácia',       emoji: '💊' },
  { slug: 'pet_shop',           nome: 'Pet Shop',       emoji: '🐾' },
  { slug: 'material_construcao',nome: 'Construção',     emoji: '🔨' },
]

interface ProdutoImport {
  nome: string; descricao: string; categoria: string
  unidade_medida: string; arquivo_foto: string
  foto?: File; status: 'pendente'|'enviando'|'ok'|'erro'; erro?: string
}

export default function AdminProdutos() {
  const [produtos, setProdutos]       = useState<any[]>([])
  const [estoqueMap, setEstoqueMap]   = useState<Record<string, any[]>>({})
  const [modal, setModal]             = useState(false)
  const [modalImport, setModalImport] = useState(false)
  const [importando, setImportando]   = useState(false)
  const [progresso, setProgresso]     = useState(0)
  const [itensImport, setItensImport] = useState<ProdutoImport[]>([])
  const [fotosImport, setFotosImport] = useState<File[]>([])
  const [nome, setNome]               = useState('')
  const [descricao, setDescricao]     = useState('')
  const [categoria, setCategoria]     = useState('bebidas')
  const [unidade, setUnidade]         = useState('un')
  const [foto, setFoto]               = useState<File|null>(null)
  const [fotoNome, setFotoNome]       = useState('')
  const [erro, setErro]               = useState('')
  const [loading, setLoading]         = useState(false)
  const [filtroCat, setFiltroCat]     = useState('todos')
  const [busca, setBusca]             = useState('')
  const csvRef   = useRef<HTMLInputElement>(null)
  const fotosRef = useRef<HTMLInputElement>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: prods } = await supabase.from('produtos').select('*').order('nome')
    setProdutos(prods ?? [])
    const { data: est } = await supabase
      .from('estoque').select('produto_id, preco, quantidade, parceiros ( nome_fantasia )')
      .gt('quantidade', 0).gt('preco', 0).eq('ativo', true)
    const map: Record<string, any[]> = {}
    ;(est ?? []).forEach((e: any) => {
      if (!map[e.produto_id]) map[e.produto_id] = []
      map[e.produto_id].push({ nome: e.parceiros?.nome_fantasia, preco: e.preco, quantidade: e.quantidade })
    })
    Object.keys(map).forEach(k => map[k].sort((a,b) => a.preco - b.preco))
    setEstoqueMap(map)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome) return setErro('Nome é obrigatório.')
    setLoading(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    let imagem_url = ''
    if (foto) {
      const ext  = foto.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('produtos').upload(path, foto, { upsert: true })
      if (!upErr) {
        const { data: url } = supabase.storage.from('produtos').getPublicUrl(path)
        imagem_url = url.publicUrl
      }
    }
    const { error } = await supabase.from('produtos').insert({
      nome: nome.trim(), descricao: descricao.trim(), categoria,
      unidade_medida: unidade, imagem_url, ativo: true, criado_por: user?.id,
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

  async function processarCSV(file: File) {
    const texto = await file.text()
    const linhas = texto.split('\n').filter(l => l.trim())
    const headers = linhas[0].split(',').map(h => h.trim().toLowerCase())
    const items: ProdutoImport[] = linhas.slice(1).map(linha => {
      const cols = linha.split(',').map(c => c.trim().replace(/^"|"$/g,''))
      const obj: any = {}
      headers.forEach((h, i) => obj[h] = cols[i] ?? '')
      return {
        nome: obj.nome || '',
        descricao: obj.descricao || obj.nome || '',
        categoria: obj.categoria || 'outros',
        unidade_medida: obj.unidade_medida || 'un',
        arquivo_foto: obj.arquivo_foto || '',
        status: 'pendente' as const,
      }
    }).filter(i => i.nome)
    setItensImport(items)
  }

  async function executarImport() {
    setImportando(true)
    for (let i = 0; i < itensImport.length; i++) {
      const item = itensImport[i]
      setItensImport(prev => prev.map((p,idx) => idx===i ? {...p,status:'enviando'} : p))
      const { error } = await supabase.from('produtos').insert({
        nome: item.nome, descricao: item.descricao,
        categoria: item.categoria, unidade_medida: item.unidade_medida, ativo: true,
      })
      setItensImport(prev => prev.map((p,idx) => idx===i ? {...p,status:error?'erro':'ok',erro:error?.message} : p))
      setProgresso(Math.round(((i+1)/itensImport.length)*100))
    }
    setImportando(false)
    carregar()
  }

  const filtrados = produtos.filter(p => {
    if (filtroCat !== 'todos' && p.categoria !== filtroCat) return false
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  return (
    <div style={s.wrap} className="anim-fadeIn">
      {/* Cabeçalho */}
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Produtos <span style={s.countBadge}>{produtos.length}</span></h1>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setModalImport(true)} style={s.btnSecundario}>
            📥 Importar CSV
          </button>
          <button onClick={() => setModal(true)} style={s.btnNovo}>
            + Novo produto
          </button>
        </div>
      </div>

      {/* Busca */}
      <input style={s.busca} placeholder="🔍  Buscar produto..."
        value={busca} onChange={e => setBusca(e.target.value)} />

      {/* Filtros de categoria — chips */}
      <div style={s.chips}>
        {CATEGORIAS_SISTEMA.map(cat => (
          <button key={cat.slug} onClick={() => setFiltroCat(cat.slug)}
            style={{
              ...s.chip,
              background: filtroCat === cat.slug ? AZUL : '#F4F6FB',
              color: filtroCat === cat.slug ? '#fff' : TEXTO_MEIO,
              border: `1.5px solid ${filtroCat === cat.slug ? AZUL : CINZA_BORDA}`,
            }}>
            {cat.emoji} {cat.nome}
            {cat.slug !== 'todos' && (
              <span style={{ ...s.chipCount, background: filtroCat === cat.slug ? 'rgba(255,255,255,0.25)' : '#E2E8F0' }}>
                {produtos.filter(p => p.categoria === cat.slug).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabela de produtos */}
      <div style={s.tabela}>
        <div style={s.tableHeader}>
          <div style={{ width: 48 }} />
          <div style={{ flex: 1 }}>PRODUTO</div>
          <div style={s.hCol}>CATEGORIA</div>
          <div style={s.hCol}>UNID</div>
          <div style={s.hCol}>PARCEIROS</div>
          <div style={s.hCol}>STATUS</div>
          <div style={s.hCol}>AÇÃO</div>
        </div>

        {filtrados.map((p, idx) => {
          const cat = CATEGORIAS_SISTEMA.find(c => c.slug === p.categoria)
          const parceiros = estoqueMap[p.id] ?? []
          return (
            <div key={p.id} style={{ ...s.row, background: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
              {/* Foto */}
              <div style={s.cellFoto}>
                {p.imagem_url
                  ? <img src={p.imagem_url} alt={p.nome} style={s.thumb} />
                  : <div style={s.thumbPlaceholder}>
                      <img src="/logo.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.35 }} />
                    </div>
                }
              </div>
              {/* Nome */}
              <div style={{ flex: 1, padding: '0 12px' }}>
                <div style={s.prodNome}>{p.nome}</div>
                {p.descricao && p.descricao !== p.nome && (
                  <div style={s.prodDesc}>{p.descricao.slice(0, 60)}{p.descricao.length > 60 ? '…' : ''}</div>
                )}
              </div>
              {/* Categoria */}
              <div style={s.cell}>
                <span style={{ ...s.catPill, background: AZUL + '15', color: AZUL }}>
                  {cat?.emoji} {cat?.nome ?? p.categoria}
                </span>
              </div>
              {/* Unidade */}
              <div style={{ ...s.cell, color: TEXTO_MEIO }}>{p.unidade_medida}</div>
              {/* Parceiros */}
              <div style={s.cell}>
                {parceiros.length > 0
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: VERDE }}>✅ {parceiros.length}</span>
                  : <span style={{ fontSize: 12, color: '#CBD5E1' }}>○ 0</span>
                }
              </div>
              {/* Status */}
              <div style={s.cell}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                  background: p.ativo ? '#DCFCE7' : '#FEE2E2',
                  color: p.ativo ? '#15803D' : VERMELHO,
                }}>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {/* Ação */}
              <div style={s.cell}>
                <button onClick={() => toggleAtivo(p.id, p.ativo)}
                  style={{ ...s.btnAcao, color: p.ativo ? VERMELHO : VERDE }}>
                  {p.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          )
        })}

        {filtrados.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: TEXTO_MEIO }}>
            Nenhum produto encontrado.
          </div>
        )}
      </div>

      {/* Modal novo produto */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>Novo produto</h2>
              <button onClick={() => setModal(false)} style={s.fechar}>✕</button>
            </div>
            <form onSubmit={salvar} style={s.form}>
              <div style={s.campo}><label style={s.label}>Nome *</label>
                <input style={s.input} value={nome} onChange={e => setNome(e.target.value)} required /></div>
              <div style={s.campo}><label style={s.label}>Descrição</label>
                <input style={s.input} value={descricao} onChange={e => setDescricao(e.target.value)} /></div>
              <div style={s.grid2}>
                <div style={s.campo}><label style={s.label}>Categoria</label>
                  <select style={s.input} value={categoria} onChange={e => setCategoria(e.target.value)}>
                    {CATEGORIAS_SISTEMA.filter(c => c.slug !== 'todos').map(c => (
                      <option key={c.slug} value={c.slug}>{c.emoji} {c.nome}</option>
                    ))}
                  </select>
                </div>
                <div style={s.campo}><label style={s.label}>Unidade</label>
                  <select style={s.input} value={unidade} onChange={e => setUnidade(e.target.value)}>
                    {['un','kg','g','l','ml','pct','cx','fardo','dp'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.campo}><label style={s.label}>Foto do produto</label>
                <label style={s.uploadLabel}>
                  <input type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if(f){setFoto(f);setFotoNome(f.name)} }} />
                  📎 {fotoNome || 'Selecionar imagem'}
                </label>
              </div>
              {erro && <p style={{ color: VERMELHO, fontSize: 13 }}>{erro}</p>}
              <button type="submit" disabled={loading} style={s.btnSalvar}>
                {loading ? 'Salvando...' : 'Salvar produto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal importar CSV */}
      {modalImport && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModalImport(false)}>
          <div style={s.modal}>
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>Importar CSV</h2>
              <button onClick={() => setModalImport(false)} style={s.fechar}>✕</button>
            </div>
            <div style={s.form}>
              <p style={{ fontSize: 13, color: TEXTO_MEIO }}>
                CSV com colunas: <code>nome, descricao, categoria, unidade_medida, arquivo_foto</code>
              </p>
              <label style={s.uploadLabel}>
                <input ref={csvRef} type="file" accept=".csv" style={{ display:'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if(f) processarCSV(f) }} />
                📄 Selecionar arquivo CSV
              </label>
              {itensImport.length > 0 && (
                <>
                  <div style={{ fontSize: 13, color: TEXTO_MEIO }}>{itensImport.length} produtos encontrados</div>
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: `1px solid ${CINZA_BORDA}`, borderRadius: 8 }}>
                    {itensImport.map((item, i) => (
                      <div key={i} style={{ padding: '8px 12px', borderBottom: `1px solid ${CINZA_BORDA}`, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>{item.nome}</span>
                        <span style={{ color: item.status==='ok' ? VERDE : item.status==='erro' ? VERMELHO : TEXTO_MEIO }}>
                          {item.status === 'ok' ? '✅' : item.status === 'erro' ? '❌' : item.status === 'enviando' ? '⏳' : '○'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {importando && (
                    <div style={{ background: '#F4F6FB', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, color: TEXTO_MEIO, marginBottom: 6 }}>Importando... {progresso}%</div>
                      <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3 }}>
                        <div style={{ height: 6, background: AZUL, borderRadius: 3, width: `${progresso}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                  <button onClick={executarImport} disabled={importando} style={s.btnSalvar}>
                    {importando ? `Importando ${progresso}%...` : `Importar ${itensImport.length} produtos`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 16 },
  cabecalho:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titulo:      { fontSize: 22, fontWeight: 800, color: TEXTO, margin: 0, display: 'flex', alignItems: 'center', gap: 10 },
  countBadge:  { fontSize: 13, fontWeight: 700, background: '#EEF2FF', color: AZUL, padding: '2px 10px', borderRadius: 20 },
  btnNovo:     { background: AZUL, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario:{ background: '#F4F6FB', color: TEXTO, border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  busca:       { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: TEXTO, background: '#fff', outline: 'none', fontFamily: 'inherit' },
  chips:       { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip:        { padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  chipCount:   { fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10 },
  tabela:      { background: '#fff', border: `1px solid ${CINZA_BORDA}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tableHeader: { display: 'flex', alignItems: 'center', background: '#1E293B', padding: '0 8px', height: 40 },
  hCol:        { width: 120, textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.07em', textTransform: 'uppercase' as const },
  row:         { display: 'flex', alignItems: 'center', borderBottom: `1px solid ${CINZA_BORDA}`, minHeight: 56 },
  cellFoto:    { width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thumb:       { width: 40, height: 40, borderRadius: 6, objectFit: 'cover' as const },
  thumbPlaceholder:{ width: 40, height: 40, borderRadius: 6, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  prodNome:    { fontSize: 13, fontWeight: 700, color: TEXTO },
  prodDesc:    { fontSize: 11, color: TEXTO_MEIO, marginTop: 2 },
  cell:        { width: 120, textAlign: 'center' as const, fontSize: 12, padding: '4px 8px' },
  catPill:     { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 },
  btnAcao:     { background: 'none', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:       { background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' as const },
  modalTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 18, fontWeight: 800, color: TEXTO, margin: 0 },
  fechar:      { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXTO_MEIO },
  form:        { display: 'flex', flexDirection: 'column', gap: 14 },
  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  campo:       { display: 'flex', flexDirection: 'column', gap: 4 },
  label:       { fontSize: 12, fontWeight: 700, color: TEXTO_MEIO },
  input:       { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: TEXTO, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  uploadLabel: { padding: '12px', border: `1.5px dashed ${CINZA_BORDA}`, borderRadius: 8, fontSize: 13, color: TEXTO_MEIO, cursor: 'pointer', textAlign: 'center' as const },
  btnSalvar:   { background: AZUL, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
}
