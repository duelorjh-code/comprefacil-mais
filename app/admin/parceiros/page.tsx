'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, VERDE, VERMELHO, DOURADO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'
import { useCidade } from '@/lib/cidade-context'
import Chat from '@/app/components/Chat'

const CATEGORIAS_SISTEMA: Record<string, { nome: string; emoji: string }> = {
  bebidas:             { nome: 'Bebidas',               emoji: '🍺' },
  conveniencia:        { nome: 'Conveniência',           emoji: '🏪' },
  mercearia:           { nome: 'Mercearia',              emoji: '🛒' },
  churrasco:           { nome: 'Churrasco',              emoji: '🥩' },
  tabacaria:           { nome: 'Tabacaria',              emoji: '🚬' },
  bomboniere:          { nome: 'Bomboniere',             emoji: '🍬' },
  petiscos:            { nome: 'Petiscos',               emoji: '🍿' },
  terere:              { nome: 'Tereré',                 emoji: '🧉' },
  padaria:             { nome: 'Padaria',                emoji: '🥖' },
  farmacia:            { nome: 'Farmácia',               emoji: '💊' },
  pet_shop:            { nome: 'Pet Shop',               emoji: '🐾' },
  material_construcao: { nome: 'Mat. Construção',        emoji: '🔨' },
}

const VAZIO = {
  nome_completo:'', nome_fantasia:'', telefone:'', cnpj_cpf:'',
  cep:'', endereco:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'',
  lat:'', lng:'', pix_chave:'', pix_tipo:'cpf',
  horario_abertura:'08:00', horario_fechamento:'22:00',
}

function Campo({ label, valor, onChange, placeholder, type }: any) {
  return (
    <div style={s.campoWrap}>
      <label style={s.label}>{label}</label>
      <input value={valor} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} type={type || 'text'} style={s.input} />
    </div>
  )
}

function RamoPill({ slug }: { slug: string }) {
  const info = CATEGORIAS_SISTEMA[slug]
  if (!info) return <span style={s.ramoPill}>{slug}</span>
  return <span style={s.ramoPill}>{info.emoji} {info.nome}</span>
}

export default function AdminParceiros() {
  const { cidade, suffix } = useCidade()
  const [aba, setAba]               = useState<'ativos'|'pendentes'>('ativos')
  const [parceiros, setParceiros]   = useState<any[]>([])
  const [pendentes, setPendentes]   = useState<any[]>([])
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState({...VAZIO})
  const [docFile, setDocFile]       = useState<File|null>(null)
  const [loading, setLoading]       = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [erro, setErro]             = useState('')
  const [busca, setBusca]           = useState('')
  const [loadingPag, setLoadingPag] = useState(true)
  const [senhaGerada, setSenhaGerada] = useState('')
  const [ativando, setAtivando]     = useState<string|null>(null)
  const [modalPend, setModalPend]   = useState<any|null>(null)
  const [chatParceiro, setChatParceiro] = useState<{id:string,nome:string}|null>(null)
  const [meuId, setMeuId]               = useState('')

  useEffect(() => { carregar() }, [cidade])
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setMeuId(user.id) })
  }, [])

  async function carregar() {
    setLoadingPag(true)
    const [{ data: parc }, { data: pend }] = await Promise.all([
      supabase.from(`parceiros${suffix}`)
        .select('id, usuario_id, nome_fantasia, cidade, estado, telefone, ativo, saldo, pix_chave, horario_abertura, horario_fechamento, lat, lng, documento_url, categorias')
        .order('criado_em', { ascending: false }),
      supabase.from(`parceiros_pre_cadastro${suffix}`)
        .select('*')
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false }),
    ])
    setParceiros(parc ?? [])
    setPendentes(pend ?? [])
    setLoadingPag(false)
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function buscarCep(v: string) {
    const c = v.replace(/\D/g, '')
    if (c.length !== 8) return
    setLoadingCep(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json()
      if (!d.erro) setForm(f => ({ ...f, endereco: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }))
    } finally { setLoadingCep(false) }
  }

  async function geocodificar() {
    const queries = [
      `${form.endereco} ${form.numero}, ${form.cidade}, ${form.estado}, Brasil`,
      `${form.endereco}, ${form.cidade}, ${form.estado}, Brasil`,
      `${form.cidade}, ${form.estado}, Brasil`,
    ]
    for (const q of queries) {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`, { headers: { 'User-Agent': 'CompreFacilMais/1.0' } })
      const d = await r.json()
      if (d[0]) { setForm(f => ({ ...f, lat: d[0].lat, lng: d[0].lon })); return }
      await new Promise(r => setTimeout(r, 500))
    }
    setForm(f => ({ ...f, lat: '-20.7680', lng: '-51.7195' }))
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome_completo || !form.telefone || !form.cnpj_cpf || !form.endereco || !form.numero) {
      return setErro('Preencha todos os campos obrigatórios.')
    }
    setLoading(true)
    const tel   = form.telefone.replace(/\D/g, '')
    const email = `${tel}@cfm.app`
    const senhaProvisoria = String(Math.floor(100000 + Math.random() * 900000))

    const apiRes = await fetch('/api/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senhaProvisoria, role: 'parceiro', nome: form.nome_completo.trim(), telefone: tel }),
    })
    const apiData = await apiRes.json()
    if (!apiRes.ok) { setLoading(false); return setErro(apiData.error ?? 'Erro ao criar acesso.') }
    const userId = apiData.data?.user?.id
    if (!userId) { setLoading(false); return setErro('Erro ao criar usuário.') }

    let docUrl = ''
    if (docFile) {
      const ext  = docFile.name.split('.').pop()
      const path = `${userId}/documento.${ext}`
      await supabase.storage.from('documentos').upload(path, docFile, { upsert: true })
      const { data: u } = supabase.storage.from('documentos').getPublicUrl(path)
      docUrl = u.publicUrl
    }

    await supabase.from(`perfis${suffix}`).upsert({
      id: userId, telefone: tel,
      nome: form.nome_completo.trim(), role: 'parceiro', primeiro_acesso: true,
    })

    const { error: errP } = await supabase.from(`parceiros${suffix}`).insert({
      usuario_id: userId,
      nome_completo: form.nome_completo.trim(),
      nome_fantasia: form.nome_fantasia.trim(),
      telefone: tel,
      cnpj_cpf: form.cnpj_cpf.replace(/\D/g, ''),
      cep: form.cep.replace(/\D/g, ''),
      endereco: form.endereco,
      numero: form.numero,
      complemento: form.complemento,
      bairro: form.bairro,
      cidade: form.cidade,
      estado: form.estado,
      lat: parseFloat(form.lat) || -20.7680,
      lng: parseFloat(form.lng) || -51.7195,
      pix_chave: form.pix_chave,
      pix_tipo: form.pix_tipo,
      horario_abertura: form.horario_abertura,
      horario_fechamento: form.horario_fechamento,
      documento_url: docUrl,
      ativo: true,
      status_cadastro: 'ativo',
    })

    setLoading(false)
    if (errP) return setErro('Erro ao cadastrar: ' + errP.message)
    setSenhaGerada(senhaProvisoria)
    setModal(false); setForm({...VAZIO}); setDocFile(null); carregar()
  }

  // Ativar parceiro vindo do pré-cadastro
  async function ativarPendente(p: any) {
    setAtivando(p.id)
    const tel   = p.telefone.replace(/\D/g, '')
    const email = `${tel}@cfm.app`
    const senhaProvisoria = String(Math.floor(100000 + Math.random() * 900000))

    // Criar usuário
    const apiRes = await fetch('/api/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senhaProvisoria, role: 'parceiro', nome: p.nome_completo.trim(), telefone: tel }),
    })
    const apiData = await apiRes.json()
    if (!apiRes.ok) { setAtivando(null); return alert('Erro ao criar acesso: ' + apiData.error) }
    const userId = apiData.data?.user?.id
    if (!userId) { setAtivando(null); return alert('Erro ao criar usuário.') }

    await supabase.from(`perfis${suffix}`).upsert({
      id: userId, telefone: tel,
      nome: p.nome_completo.trim(), role: 'parceiro', primeiro_acesso: true,
    })

    const { error: errP } = await supabase.from(`parceiros${suffix}`).insert({
      usuario_id:         userId,
      nome_completo:      p.nome_completo,
      nome_fantasia:      p.nome_fantasia || p.nome_completo,
      telefone:           tel,
      cnpj_cpf:           p.cnpj_cpf || '',
      cep:                p.cep || '',
      endereco:           p.endereco || '',
      numero:             p.numero || '',
      complemento:        p.complemento || '',
      bairro:             p.bairro || '',
      cidade:             p.cidade || '',
      estado:             p.estado || '',
      lat:                -20.7680,
      lng:                -51.7195,
      pix_chave:          p.pix_chave || '',
      pix_tipo:           p.pix_tipo || 'cpf',
      horario_abertura:   p.horario_abertura || '08:00',
      horario_fechamento: p.horario_fechamento || '22:00',
      categorias:         p.categorias || [],
      tipo:               p.categorias?.[0] || 'conveniencia',
      ativo:              true,
      status_cadastro:    'ativo',
    })

    if (errP) { setAtivando(null); return alert('Erro ao ativar: ' + errP.message) }

    // Marcar pré-cadastro como aprovado
    await supabase.from(`parceiros_pre_cadastro${suffix}`)
      .update({ status: 'aprovado', analisado_em: new Date().toISOString() })
      .eq('id', p.id)

    // Montar mensagem WhatsApp para o parceiro
    const ramos = (p.categorias || [])
      .map((slug: string) => CATEGORIAS_SISTEMA[slug]?.nome || slug)
      .join(', ')

    const msg = encodeURIComponent(
      `🎉 *Bem-vindo ao CompreFácil+, ${p.nome_fantasia || p.nome_completo}!*\n\n` +
      `Seu cadastro foi aprovado e seu acesso está liberado.\n\n` +
      `📱 *Acesse o sistema:*\n` +
      `Login: ${email}\n` +
      `Senha: *${senhaProvisoria}*\n\n` +
      `📋 *Próximos passos:*\n` +
      `1️⃣ Acesse e confira seus dados (Nome Fantasia e chave PIX)\n` +
      `2️⃣ Vá em *Estoque* → informe o preço e a quantidade de cada produto\n` +
      `3️⃣ Produto com preço *E* quantidade → aparece automaticamente na Vitrine\n` +
      `⚠️ Produto com preço mas quantidade *zero* = não aparece na Vitrine\n\n` +
      `Qualquer dúvida, entre em contato conosco. Boas vendas! 🚀`
    )

    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')

    setAtivando(null)
    setModalPend(null)
    setSenhaGerada(senhaProvisoria)
    carregar()
  }

  async function rejeitarPendente(id: string) {
    if (!confirm('Rejeitar este cadastro?')) return
    await supabase.from(`parceiros_pre_cadastro${suffix}`)
      .update({ status: 'rejeitado', analisado_em: new Date().toISOString() })
      .eq('id', id)
    setModalPend(null)
    carregar()
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from(`parceiros${suffix}`).update({ ativo: !ativo }).eq('id', id)
    carregar()
  }

  async function acessarComo(usuarioId: string) {
    const res  = await fetch('/api/admin/impersonar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId }),
    })
    const json = await res.json()
    if (json.url) window.open(json.url, '_blank')
    else alert('Erro ao gerar acesso: ' + (json.erro ?? 'desconhecido'))
  }

  const filtrados = parceiros.filter(p =>
    !busca ||
    p.nome_fantasia?.toLowerCase().includes(busca.toLowerCase()) ||
    p.cidade?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Parceiros</h1>
        <button onClick={() => setModal(true)} style={s.btnNovo}>+ Novo parceiro</button>
      </div>

      {/* Abas */}
      <div style={s.abas}>
        <button onClick={() => setAba('ativos')}
          style={{ ...s.aba, ...(aba === 'ativos' ? s.abaAtiva : {}) }}>
          Ativos ({parceiros.length})
        </button>
        <button onClick={() => setAba('pendentes')}
          style={{ ...s.aba, ...(aba === 'pendentes' ? s.abaAtiva : {}), position: 'relative' as const }}>
          Pendentes ({pendentes.length})
          {pendentes.length > 0 && <span style={s.badge}>{pendentes.length}</span>}
        </button>
      </div>

      {/* ABA ATIVOS */}
      {aba === 'ativos' && <>
        <input style={s.busca} placeholder="🔍  Buscar parceiro…"
          value={busca} onChange={e => setBusca(e.target.value)} />

        {loadingPag ? (
          <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
        ) : (
          <div style={s.grid}>
            {filtrados.map(p => (
              <div key={p.id} style={{ ...s.card, opacity: p.ativo ? 1 : 0.6 }}>
                <div style={s.cardTop}>
                  <div style={{ flex: 1 }}>
                    <div style={s.cardNome}>{p.nome_fantasia}</div>
                    <div style={s.cardSub}>{p.cidade} · {p.estado}</div>
                    {p.categorias?.length > 0 && (
                      <div style={s.ramosWrap}>
                        {p.categorias.map((cat: string) => <RamoPill key={cat} slug={cat} />)}
                      </div>
                    )}
                  </div>
                  <span style={{ ...s.pill, background: p.ativo ? '#22C55E20' : '#EF444420', color: p.ativo ? VERDE : VERMELHO }}>
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div style={s.cardInfo}>
                  <div style={s.infoItem}><span style={s.infoL}>Saldo</span><span style={{ ...s.infoV, color: AZUL, fontWeight: 800 }}>{formatBRL(p.saldo ?? 0)}</span></div>
                  <div style={s.infoItem}><span style={s.infoL}>Telefone</span><span style={s.infoV}>{p.telefone}</span></div>
                  <div style={s.infoItem}><span style={s.infoL}>PIX</span><span style={s.infoV}>{p.pix_chave || '–'}</span></div>
                  <div style={s.infoItem}><span style={s.infoL}>Horário</span><span style={s.infoV}>{p.horario_abertura} – {p.horario_fechamento}</span></div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleAtivo(p.id, p.ativo)}
                    style={{ ...s.btnToggle, flex: 1, background: p.ativo ? '#EF444420' : '#22C55E20', color: p.ativo ? VERMELHO : VERDE }}>
                    {p.ativo ? '⏸ Forçar Offline' : '▶ Forçar Online'}
                  </button>
                  <button onClick={() => acessarComo(p.usuario_id)}
                    style={{ ...s.btnToggle, background: '#EEF2FF', color: AZUL }}>
                    👁 Acessar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>}

      {/* ABA PENDENTES */}
      {aba === 'pendentes' && (
        loadingPag ? (
          <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
        ) : pendentes.length === 0 ? (
          <div style={s.vazio}>
            <div style={{ fontSize: 40 }}>✅</div>
            <p>Nenhum cadastro pendente.</p>
          </div>
        ) : (
          <div style={s.grid}>
            {pendentes.map(p => (
              <div key={p.id} style={{ ...s.card, borderLeft: `4px solid ${DOURADO}` }}>
                <div style={s.cardTop}>
                  <div style={{ flex: 1 }}>
                    <div style={s.cardNome}>{p.nome_fantasia || p.nome_completo}</div>
                    <div style={s.cardSub}>{p.cidade} · {p.estado}</div>
                    {p.categorias?.length > 0 && (
                      <div style={s.ramosWrap}>
                        {p.categorias.map((cat: string) => <RamoPill key={cat} slug={cat} />)}
                      </div>
                    )}
                  </div>
                  <span style={{ ...s.pill, background: '#FDF3D8', color: DOURADO }}>
                    Pendente
                  </span>
                </div>
                <div style={s.cardInfo}>
                  <div style={s.infoItem}><span style={s.infoL}>Telefone</span><span style={s.infoV}>{p.telefone}</span></div>
                  <div style={s.infoItem}><span style={s.infoL}>CPF/CNPJ</span><span style={s.infoV}>{p.cnpj_cpf || '–'}</span></div>
                  <div style={s.infoItem}><span style={s.infoL}>PIX</span><span style={s.infoV}>{p.pix_chave || '–'}</span></div>
                  <div style={s.infoItem}><span style={s.infoL}>Solicitado</span><span style={s.infoV}>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => ativarPendente(p)} disabled={ativando === p.id}
                    style={{ ...s.btnToggle, flex: 1, background: '#22C55E20', color: VERDE, fontWeight: 800 }}>
                    {ativando === p.id ? '⏳ Ativando...' : '✅ Ativar Parceiro'}
                  </button>
                  <button onClick={() => rejeitarPendente(p.id)}
                    style={{ ...s.btnToggle, background: '#FFF1F1', color: VERMELHO }}>
                    ✕ Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal senha gerada */}
      {senhaGerada && (
        <div style={s.overlay} onClick={() => setSenhaGerada('')}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>✅ Parceiro ativado</h2>
            </div>
            <p style={{ fontSize: 13, color: TEXTO_MEIO, textAlign: 'center' as const }}>
              A mensagem de boas-vindas foi enviada ao parceiro via WhatsApp.<br />
              Senha provisória para referência:
            </p>
            <div style={{ background: '#F4F6FB', borderRadius: 12, padding: '20px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXTO_MEIO, marginBottom: 6 }}>SENHA PROVISÓRIA</div>
              <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 8, color: AZUL, fontFamily: 'monospace' }}>{senhaGerada}</div>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(senhaGerada); alert('Copiado!') }}
              style={{ ...s.btnSalvar, background: '#EEF2FF', color: AZUL }}>
              📋 Copiar senha
            </button>
            <button onClick={() => setSenhaGerada('')} style={s.btnSalvar}>Fechar</button>
          </div>
        </div>
      )}

      {/* Modal cadastro manual */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>Cadastrar parceiro</h2>
              <button onClick={() => setModal(false)} style={s.fechar}>✕</button>
            </div>
            <form onSubmit={handleSalvar} style={s.form}>
              <div style={s.grid2}>
                <Campo label="Nome completo *"  valor={form.nome_completo} onChange={(v: string) => set('nome_completo', v)} />
                <Campo label="Nome fantasia *"   valor={form.nome_fantasia}  onChange={(v: string) => set('nome_fantasia', v)} />
                <Campo label="CPF / CNPJ *"      valor={form.cnpj_cpf}       onChange={(v: string) => set('cnpj_cpf', v)} />
                <Campo label="Celular com DDD *" valor={form.telefone}       onChange={(v: string) => set('telefone', v)} placeholder="(67) 99999-0000" />
              </div>
              <div style={s.secao}>Endereço</div>
              <div style={s.grid2}>
                <div style={s.campoWrap}>
                  <label style={s.label}>CEP * {loadingCep && '🔄'}</label>
                  <input value={form.cep} onChange={e => { set('cep', e.target.value); buscarCep(e.target.value) }} placeholder="00000-000" style={s.input} />
                </div>
                <Campo label="Endereço *"  valor={form.endereco}    onChange={(v: string) => set('endereco', v)} />
                <Campo label="Número *"    valor={form.numero}      onChange={(v: string) => set('numero', v)} />
                <Campo label="Complemento" valor={form.complemento} onChange={(v: string) => set('complemento', v)} />
                <Campo label="Bairro"      valor={form.bairro}      onChange={(v: string) => set('bairro', v)} />
                <Campo label="Cidade *"    valor={form.cidade}      onChange={(v: string) => set('cidade', v)} />
                <Campo label="Estado *"    valor={form.estado}      onChange={(v: string) => set('estado', v)} />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="button" onClick={geocodificar} style={s.btnGeo}>📍 Geocodificar</button>
                {form.lat && <span style={{ fontSize: 12, color: VERDE }}>✓ {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}</span>}
              </div>
              <div style={s.secao}>Funcionamento</div>
              <div style={s.grid2}>
                <Campo label="Abertura"   valor={form.horario_abertura}   onChange={(v: string) => set('horario_abertura', v)}   type="time" />
                <Campo label="Fechamento" valor={form.horario_fechamento} onChange={(v: string) => set('horario_fechamento', v)} type="time" />
                <Campo label="Chave PIX"  valor={form.pix_chave}          onChange={(v: string) => set('pix_chave', v)} />
              </div>
              <div style={s.campoWrap}>
                <label style={s.label}>Documento (RG / CNPJ)</label>
                <input type="file" accept="image/*,.pdf" onChange={e => setDocFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
              </div>
              {erro && <div style={{ color: VERMELHO, fontSize: 13 }}>{erro}</div>}
              <button type="submit" disabled={loading} style={s.btnSalvar}>
                {loading ? 'Cadastrando...' : 'Cadastrar parceiro'}
              </button>
            </form>
          </div>
        </div>
      )}
      {chatParceiro && meuId && (
        <Chat paraId={chatParceiro.id} paraNome={chatParceiro.nome} meuId={meuId} />
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 20 },
  cabecalho:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titulo:      { fontSize: 22, fontWeight: 800, color: TEXTO, margin: 0 },
  btnNovo:     { background: AZUL, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  abas:        { display: 'flex', gap: 8, borderBottom: `2px solid ${CINZA_BORDA}`, paddingBottom: 0 },
  aba:         { padding: '10px 20px', border: 'none', background: 'none', fontSize: 14, fontWeight: 700, color: TEXTO_MEIO, cursor: 'pointer', fontFamily: 'inherit', borderBottom: '2px solid transparent', marginBottom: -2 },
  abaAtiva:    { color: AZUL, borderBottomColor: AZUL },
  badge:       { position: 'absolute', top: 2, right: 2, background: VERMELHO, color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 10 },
  busca:       { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: TEXTO, background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' },
  loading:     { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:     { width: 32, height: 32, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  vazio:       { textAlign: 'center' as const, padding: '60px 20px', color: TEXTO_MEIO, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:        { background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardNome:    { fontSize: 15, fontWeight: 800, color: TEXTO },
  cardSub:     { fontSize: 12, color: TEXTO_MEIO, marginTop: 2 },
  ramosWrap:   { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  ramoPill:    { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#EEF2FF', color: AZUL },
  pill:        { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
  cardInfo:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' },
  infoItem:    { display: 'flex', flexDirection: 'column', gap: 2 },
  infoL:       { fontSize: 10, color: TEXTO_MEIO, fontWeight: 600, textTransform: 'uppercase' as const },
  infoV:       { fontSize: 13, color: TEXTO, fontWeight: 600 },
  btnToggle:   { padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:       { background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column', gap: 20 },
  modalTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitulo: { fontSize: 18, fontWeight: 800, color: TEXTO, margin: 0 },
  fechar:      { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXTO_MEIO },
  form:        { display: 'flex', flexDirection: 'column', gap: 14 },
  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  secao:       { fontSize: 12, fontWeight: 800, color: TEXTO_MEIO, textTransform: 'uppercase' as const, borderBottom: `1px solid ${CINZA_BORDA}`, paddingBottom: 4 },
  campoWrap:   { display: 'flex', flexDirection: 'column', gap: 4 },
  label:       { fontSize: 12, fontWeight: 700, color: TEXTO_MEIO },
  input:       { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, color: TEXTO, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  btnGeo:      { background: '#EEF2FF', color: AZUL, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSalvar:   { background: AZUL, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
}
