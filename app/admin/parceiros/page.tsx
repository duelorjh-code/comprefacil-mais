'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const VAZIO = {
  nome_completo:'', nome_fantasia:'', telefone:'', cnpj_cpf:'',
  cep:'', endereco:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'',
  lat:'', lng:'', pix_chave:'', pix_tipo:'cpf',
  horario_abertura:'08:00', horario_fechamento:'22:00',
}

export default function AdminParceiros() {
  const [parceiros, setParceiros] = useState<any[]>([])
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({...VAZIO})
  const [docFile, setDocFile]     = useState<File|null>(null)
  const [loading, setLoading]     = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [erro, setErro]           = useState('')
  const [busca, setBusca]         = useState('')
  const [loadingPag, setLoadingPag] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoadingPag(true)
    const { data } = await supabase.from('parceiros').select(`
      *, perfis ( nome, telefone, bloqueado )
    `).order('criado_em', { ascending: false })
    setParceiros(data ?? [])
    setLoadingPag(false)
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function buscarCep(cep: string) {
    const c = cep.replace(/\D/g,'')
    if (c.length !== 8) return
    setLoadingCep(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json()
      if (!d.erro) {
        setForm(f => ({ ...f, endereco: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }))
      }
    } finally { setLoadingCep(false) }
  }

  function fmtCep(v: string) {
    const n = v.replace(/\D/g,'').slice(0,8)
    return n.length > 5 ? `${n.slice(0,5)}-${n.slice(5)}` : n
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome_completo || !form.telefone || !form.cnpj_cpf || !form.cep || !form.endereco || !form.numero) {
      return setErro('Preencha todos os campos obrigatórios.')
    }
    setLoading(true)

    // Geocodificação aproximada via nominatim
    let lat = -20.7, lng = -51.7
    try {
      const end = encodeURIComponent(`${form.endereco} ${form.numero}, ${form.cidade}, ${form.estado}`)
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?q=${end}&format=json&limit=1`)
      const gd  = await geo.json()
      if (gd[0]) { lat = parseFloat(gd[0].lat); lng = parseFloat(gd[0].lon) }
    } catch {}

    // Criar usuário Auth via API route (usa service role, não faz logout do admin)
    const tel   = form.telefone.replace(/\D/g,'')
    const email = `${tel}@cfm.app`

    const apiRes = await fetch('/api/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'cfm_primeiro_acesso_2024', role: 'parceiro', nome: form.nome_completo.trim(), telefone: tel }),
    })
    const apiData = await apiRes.json()

    if (!apiRes.ok || apiData.error) {
      setLoading(false)
      return setErro(apiData.error ?? 'Erro ao criar acesso.')
    }

    const userId = apiData.data?.user?.id
    if (!userId) { setLoading(false); return setErro('Erro ao criar acesso. Tente novamente.') }

    // Upload documento
    let docUrl = ''
    if (docFile) {
      const ext  = docFile.name.split('.').pop()
      const path = `${userId}/documento.${ext}`
      await supabase.storage.from('documentos').upload(path, docFile, { upsert: true })
      const { data: u } = supabase.storage.from('documentos').getPublicUrl(path)
      docUrl = u.publicUrl
    }

    // Criar parceiro
    const { error: errParceiro } = await supabase.from('parceiros').insert({
      usuario_id: userId,
      nome_completo:       form.nome_completo.trim(),
      nome_fantasia:       form.nome_fantasia.trim(),
      telefone:            tel,
      cnpj_cpf:            form.cnpj_cpf.replace(/\D/g,''),
      cep:                 form.cep.replace(/\D/g,''),
      endereco:            form.endereco,
      numero:              form.numero,
      complemento:         form.complemento,
      bairro:              form.bairro,
      cidade:              form.cidade,
      estado:              form.estado,
      lat, lng,
      pix_chave:           form.pix_chave,
      pix_tipo:            form.pix_tipo,
      horario_abertura:    form.horario_abertura,
      horario_fechamento:  form.horario_fechamento,
      documento_url:       docUrl,
    })

    setLoading(false)
    if (errParceiro) return setErro('Erro ao cadastrar parceiro: ' + errParceiro.message)

    setModal(false)
    setForm({...VAZIO})
    setDocFile(null)
    carregar()
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('parceiros').update({ ativo: !ativo }).eq('id', id)
    carregar()
  }

  const filtrados = parceiros.filter(p =>
    !busca || p.nome_fantasia.toLowerCase().includes(busca.toLowerCase()) ||
    p.cidade?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Parceiros</h1>
        <button onClick={() => setModal(true)} style={s.btnNovo}>+ Novo parceiro</button>
      </div>

      <input style={s.busca} placeholder="🔍  Buscar parceiro…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      {loadingPag ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.grid}>
          {filtrados.map(p => (
            <div key={p.id} style={{ ...s.card, opacity: p.ativo ? 1 : 0.6 }}>
              <div style={s.cardTop}>
                <div>
                  <div style={s.cardNome}>{p.nome_fantasia}</div>
                  <div style={s.cardSub}>{p.cidade} · {p.estado}</div>
                </div>
                <span style={{ ...s.pill, background: p.ativo ? '#22C55E20' : '#EF444420', color: p.ativo ? VERDE : VERMELHO }}>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={s.cardInfo}>
                <div style={s.infoItem}><span style={s.infoL}>Saldo</span><span style={{ ...s.infoV, color: AZUL, fontWeight: 800 }}>{formatBRL(p.saldo)}</span></div>
                <div style={s.infoItem}><span style={s.infoL}>Telefone</span><span style={s.infoV}>{p.telefone}</span></div>
                <div style={s.infoItem}><span style={s.infoL}>PIX</span><span style={s.infoV}>{p.pix_chave || '–'}</span></div>
                <div style={s.infoItem}><span style={s.infoL}>Horário</span><span style={s.infoV}>{p.horario_abertura} – {p.horario_fechamento}</span></div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <a
                  href={`https://wa.me/55${p.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(
                    `Olá ${p.nome_fantasia}! Seu acesso ao CompreFácil+ foi criado.\n\n` +
                    `🔗 Link: ${process.env.NEXT_PUBLIC_APP_URL}/parceiro/primeiro-acesso\n` +
                    `📱 Telefone: ${p.telefone}\n` +
                    `🔑 Senha provisória: 2024\n\n` +
                    `Acesse o link, informe o telefone, a senha provisória e defina sua nova senha.`
                  )}`}
                  target="_blank" rel="noreferrer"
                  style={{ ...s.btnToggle, flex:1, background:'#25D36620', color:'#25D366', textDecoration:'none', textAlign:'center' as const, border:'1px solid #25D36630' }}>
                  💬 Enviar acesso
                </a>
                <button onClick={() => toggleAtivo(p.id, p.ativo)}
                  style={{ ...s.btnToggle, flex:1, background: p.ativo ? '#EF444420' : '#22C55E20', color: p.ativo ? VERMELHO : VERDE }}>
                  {p.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>Cadastrar parceiro</h2>
              <button onClick={() => setModal(false)} style={s.fechar}>✕</button>
            </div>

            <form onSubmit={cadastrar} style={s.form}>
              <div style={s.grid2}>
                <Campo label="Nome completo *" valor={form.nome_completo} onChange={(v: string) => set('nome_completo',v)} />
                <Campo label="Nome fantasia *"  valor={form.nome_fantasia}  onChange={(v: string) => set('nome_fantasia',v)} />
                <Campo label="CPF / CNPJ *"     valor={form.cnpj_cpf}       onChange={(v: string) => set('cnpj_cpf',v)} />
                <Campo label="Celular com DDD *" valor={form.telefone}       onChange={(v: string) => set('telefone',v)} placeholder="(67) 99999-0000" />
              </div>

              <div style={s.secao}>Endereço</div>
              <div style={s.grid3}>
                <div style={s.campoWrap}>
                  <label style={s.label}>CEP *</label>
                  <div style={{ position:'relative' }}>
                    <input style={s.input} value={form.cep}
                      onChange={e => { const v = fmtCep(e.target.value); set('cep',v); if(v.replace(/\D/g,'').length===8) buscarCep(v) }}
                      placeholder="00000-000" maxLength={9} />
                    {loadingCep && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:12, color:TEXTO_MEIO }}>...</span>}
                  </div>
                </div>
                <Campo label="Número *"      valor={form.numero}    onChange={(v: string) => set('numero',v)} style={{ gridColumn:'span 1' }} />
                <Campo label="Complemento"   valor={form.complemento} onChange={(v: string) => set('complemento',v)} style={{ gridColumn:'span 1' }} />
              </div>
              <div style={s.grid2}>
                <Campo label="Endereço *"   valor={form.endereco} onChange={(v: string) => set('endereco',v)} />
                <Campo label="Bairro"       valor={form.bairro}   onChange={(v: string) => set('bairro',v)} />
                <Campo label="Cidade"       valor={form.cidade}   onChange={(v: string) => set('cidade',v)} />
                <Campo label="Estado (UF)"  valor={form.estado}   onChange={(v: string) => set('estado',v)} placeholder="MS" maxLength={2} />
              </div>

              <div style={s.secao}>PIX & Horário</div>
              <div style={s.grid2}>
                <Campo label="Chave PIX"    valor={form.pix_chave} onChange={(v: string) => set('pix_chave',v)} />
                <div style={s.campoWrap}>
                  <label style={s.label}>Tipo da chave</label>
                  <select style={s.input} value={form.pix_tipo} onChange={e => set('pix_tipo',e.target.value)}>
                    {['cpf','cnpj','telefone','email','aleatoria'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <Campo label="Abertura"     valor={form.horario_abertura}    onChange={(v: string) => set('horario_abertura',v)}   type="time" />
                <Campo label="Fechamento"   valor={form.horario_fechamento}   onChange={(v: string) => set('horario_fechamento',v)} type="time" />
              </div>

              <div style={s.secao}>Documento</div>
              <div style={s.campoWrap}>
                <label style={s.label}>Foto RG / CNPJ</label>
                <label style={s.uploadLabel}>
                  <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if(f) setDocFile(f) }} />
                  📎 {docFile?.name || 'Selecionar arquivo'}
                </label>
              </div>

              {erro && <p style={s.erro}>{erro}</p>}

              <div style={s.modalAcoes}>
                <button type="button" onClick={() => setModal(false)} style={s.btnCancelar}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ ...s.btnSalvar, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Salvando…' : 'Cadastrar parceiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, valor, onChange, placeholder='', type='text', style={}, maxLength=undefined }: {
  label: string; valor: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; style?: React.CSSProperties; maxLength?: number;
}) {
  return (
    <div style={{ ...{ display:'flex', flexDirection:'column', gap:5 }, ...style }}>
      <label style={{ fontSize:12, fontWeight:700, color: TEXTO }}>{label}</label>
      <input style={{ border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'11px 13px', fontSize:14, color:TEXTO, background:'#FAFBFE', outline:'none', fontFamily:'inherit' }}
        type={type} value={valor} onChange={(e:any) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength} />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:20 },
  cabecalho: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  btnNovo: { background:AZUL, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  busca: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, color:TEXTO, background:'#fff', outline:'none', fontFamily:'inherit', width:'100%' },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:32, height:32, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 },
  card: { background:'#fff', borderRadius:14, padding:'18px', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column', gap:12 },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  cardNome: { fontSize:15, fontWeight:800, color:TEXTO },
  cardSub: { fontSize:12, color:TEXTO_MEIO, marginTop:2 },
  pill: { fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 },
  cardInfo: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px' },
  infoItem: { display:'flex', flexDirection:'column', gap:2 },
  infoL: { fontSize:10, color:TEXTO_MEIO, fontWeight:600, textTransform:'uppercase' as const },
  infoV: { fontSize:13, color:TEXTO, fontWeight:600 },
  btnToggle: { padding:'8px', borderRadius:8, border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal: { background:'#fff', borderRadius:20, padding:'28px 24px', width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:20 },
  modalTop: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  modalTitulo: { fontSize:18, fontWeight:800, color:TEXTO },
  fechar: { background:'none', border:'none', fontSize:20, cursor:'pointer', color:TEXTO_MEIO },
  form: { display:'flex', flexDirection:'column', gap:16 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  grid3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 },
  secao: { fontSize:11, fontWeight:800, color:AZUL, textTransform:'uppercase' as const, letterSpacing:'0.08em', borderBottom:`2px solid #EEF2FF`, paddingBottom:6 },
  campoWrap: { display:'flex', flexDirection:'column', gap:5 },
  label: { fontSize:12, fontWeight:700, color:TEXTO },
  input: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'11px 13px', fontSize:14, color:TEXTO, background:'#FAFBFE', outline:'none', fontFamily:'inherit', width:'100%' },
  uploadLabel: { padding:'11px 13px', border:`1.5px dashed ${CINZA_BORDA}`, borderRadius:10, fontSize:13, color:TEXTO_MEIO, cursor:'pointer', textAlign:'center' as const, fontWeight:600 },
  erro: { fontSize:13, color:'#EF4444', fontWeight:600, background:'#FFF1F1', borderRadius:10, padding:'10px 14px', border:'1px solid #FEE2E2' },
  modalAcoes: { display:'flex', justifyContent:'flex-end', gap:12 },
  btnCancelar: { padding:'12px 20px', borderRadius:10, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', color:TEXTO_MEIO, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSalvar: { padding:'12px 24px', borderRadius:10, background:AZUL, color:'#fff', border:'none', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
}
