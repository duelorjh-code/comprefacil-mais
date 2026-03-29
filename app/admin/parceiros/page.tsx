'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

function Campo({ label, valor, onChange, placeholder, type, inputMode }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: TEXTO_MEIO }}>{label}</label>
      <input value={valor} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        type={type || 'text'} inputMode={inputMode}
        style={{ border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, color: TEXTO, outline: 'none', fontFamily: 'inherit', background: '#fff' }} />
    </div>
  )
}

const FORM_INIT = { nome_completo: '', nome_fantasia: '', cnpj_cpf: '', telefone: '', cep: '', endereco: '', numero: '', bairro: '', cidade: '', estado: '', lat: '', lng: '', horario_abertura: '08:00', horario_fechamento: '22:00' }

export default function AdminParceiros() {
  const [lista, setLista]     = useState<any[]>([])
  const [busca, setBusca]     = useState('')
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(FORM_INIT)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]       = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('parceiros')
      .select('id, nome_fantasia, cidade, estado, telefone, ativo, online, saldo, pix_chave, horario_abertura, horario_fechamento, lat, lng')
      .order('nome_fantasia')
    setLista(data ?? [])
    setLoading(false)
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function buscarCEP(cep: string) {
    const c = cep.replace(/\D/g, '')
    if (c.length !== 8) return
    const r = await fetch(`https://viacep.com.br/ws/${c}/json/`).then(r => r.json()).catch(() => null)
    if (r && !r.erro) setForm(f => ({ ...f, endereco: r.logradouro || '', bairro: r.bairro || '', cidade: r.localidade || '', estado: r.uf || '' }))
  }

  async function geocodificar() {
    const end = `${form.endereco}, ${form.numero}, ${form.cidade}, ${form.estado}, Brasil`
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(end)}`
    const r = await fetch(url).then(r => r.json()).catch(() => [])
    if (r[0]) setForm(f => ({ ...f, lat: r[0].lat, lng: r[0].lon }))
  }

  async function toggleOnline(id: string, online: boolean) {
    await supabase.from('parceiros').update({ online: !online }).eq('id', id)
    carregar()
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('parceiros').update({ ativo: !ativo }).eq('id', id)
    carregar()
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSalvando(true)
    const tel = form.telefone.replace(/\D/g, '')
    const email = `${tel}@cfm.app`

    const apiRes = await fetch('/api/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: '202400', role: 'parceiro', nome: form.nome_completo.trim(), telefone: tel }),
    })
    const apiData = await apiRes.json()
    if (!apiRes.ok || apiData.error) { setErro(apiData.error ?? 'Erro ao criar acesso.'); setSalvando(false); return }

    const userId = apiData.data?.user?.id
    if (!userId) { setErro('Erro ao criar usuário.'); setSalvando(false); return }

    const { error } = await supabase.from('parceiros').insert({
      usuario_id:         userId,
      nome_fantasia:      form.nome_fantasia,
      cnpj_cpf:           form.cnpj_cpf.replace(/\D/g, ''),
      telefone:           tel,
      cep:                form.cep.replace(/\D/g, ''),
      endereco:           form.endereco,
      numero:             form.numero,
      bairro:             form.bairro,
      cidade:             form.cidade,
      estado:             form.estado,
      lat:                parseFloat(form.lat) || null,
      lng:                parseFloat(form.lng) || null,
      horario_abertura:   form.horario_abertura,
      horario_fechamento: form.horario_fechamento,
      ativo:              true,
      online:             false,
    })

    if (error) { setErro(error.message); setSalvando(false); return }
    setModal(false); setForm(FORM_INIT); setSalvando(false); carregar()
  }

  const filtrados = lista.filter(p => !busca || p.nome_fantasia?.toLowerCase().includes(busca.toLowerCase()) || p.telefone?.includes(busca))

  return (
    <div style={s.wrap}>
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Parceiros <span style={s.count}>{lista.length}</span></h1>
        <button onClick={() => setModal(true)} style={s.btnNovo}>+ Novo parceiro</button>
      </div>

      <input style={s.busca} placeholder="🔍 Buscar por nome ou telefone…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: TEXTO_MEIO }}>Carregando...</div>
      ) : (
        <div style={s.grid}>
          {filtrados.map(p => (
            <div key={p.id} style={{ ...s.card, opacity: p.ativo ? 1 : 0.6 }}>
              <div style={s.cardTop}>
                <div style={s.cardNome}>{p.nome_fantasia}</div>
                <span style={{ ...s.pill, background: p.online ? '#22C55E20' : '#6B728020', color: p.online ? VERDE : '#6B7280' }}>
                  {p.online ? '● Online' : '○ Offline'}
                </span>
              </div>
              <div style={s.cardSub}>{p.cidade} · {p.estado} · {p.telefone}</div>
              <div style={s.cardInfo}>
                <div style={s.infoItem}><span style={s.infoL}>Saldo</span><span style={{ ...s.infoV, color: AZUL, fontWeight: 800 }}>{formatBRL(p.saldo ?? 0)}</span></div>
                <div style={s.infoItem}><span style={s.infoL}>PIX</span><span style={s.infoV}>{p.pix_chave || '–'}</span></div>
                <div style={s.infoItem}><span style={s.infoL}>Horário</span><span style={s.infoV}>{p.horario_abertura} – {p.horario_fechamento}</span></div>
              </div>
              <div style={s.acoes}>
                <button onClick={() => toggleOnline(p.id, p.online)}
                  style={{ ...s.btn, background: p.online ? '#EF444420' : '#22C55E20', color: p.online ? VERMELHO : VERDE }}>
                  {p.online ? '⏸ Forçar Offline' : '▶ Forçar Online'}
                </button>
                <button onClick={() => toggleAtivo(p.id, p.ativo)}
                  style={{ ...s.btn, background: p.ativo ? '#6B728020' : '#22C55E20', color: p.ativo ? '#6B7280' : VERDE }}>
                  {p.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.modalTop}>
              <h2 style={s.modalTitulo}>Cadastrar parceiro</h2>
              <button onClick={() => setModal(false)} style={s.fechar}>✕</button>
            </div>
            <form onSubmit={cadastrar} style={s.form}>
              <div style={s.grid2}>
                <Campo label="Nome completo *" valor={form.nome_completo} onChange={(v: string) => set('nome_completo', v)} />
                <Campo label="Nome fantasia *"  valor={form.nome_fantasia}  onChange={(v: string) => set('nome_fantasia', v)} />
                <Campo label="CPF / CNPJ *"     valor={form.cnpj_cpf}       onChange={(v: string) => set('cnpj_cpf', v)} />
                <Campo label="Celular com DDD *" valor={form.telefone}       onChange={(v: string) => set('telefone', v)} placeholder="(67) 99999-0000" />
              </div>
              <div style={s.secao}>Endereço</div>
              <div style={s.grid2}>
                <Campo label="CEP *" valor={form.cep} onChange={(v: string) => { set('cep', v); buscarCEP(v) }} placeholder="00000-000" />
                <Campo label="Endereço *" valor={form.endereco} onChange={(v: string) => set('endereco', v)} />
                <Campo label="Número *"   valor={form.numero}   onChange={(v: string) => set('numero', v)} />
                <Campo label="Bairro"     valor={form.bairro}   onChange={(v: string) => set('bairro', v)} />
                <Campo label="Cidade *"   valor={form.cidade}   onChange={(v: string) => set('cidade', v)} />
                <Campo label="Estado *"   valor={form.estado}   onChange={(v: string) => set('estado', v)} />
              </div>
              <button type="button" onClick={geocodificar} style={s.btnGeo}>📍 Geocodificar endereço</button>
              {form.lat && <div style={{ fontSize: 12, color: VERDE }}>✓ Lat: {form.lat} | Lng: {form.lng}</div>}
              <div style={s.grid2}>
                <Campo label="Horário abertura"    valor={form.horario_abertura}    onChange={(v: string) => set('horario_abertura', v)}    type="time" />
                <Campo label="Horário fechamento"  valor={form.horario_fechamento}  onChange={(v: string) => set('horario_fechamento', v)}  type="time" />
              </div>
              {erro && <div style={{ color: VERMELHO, fontSize: 13 }}>{erro}</div>}
              <button type="submit" disabled={salvando} style={s.btnSalvar}>
                {salvando ? 'Cadastrando...' : 'Cadastrar parceiro'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 20 },
  cabecalho:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  titulo:      { fontSize: 22, fontWeight: 800, color: '#1A2340', margin: 0 },
  count:       { background: `${AZUL}20`, color: AZUL, fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, marginLeft: 8 },
  btnNovo:     { background: AZUL, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  busca:       { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: TEXTO, background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:        { background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 8px rgba(27,47,94,0.07)', display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardNome:    { fontSize: 15, fontWeight: 800, color: '#1A2340' },
  cardSub:     { fontSize: 12, color: TEXTO_MEIO },
  pill:        { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' as const },
  cardInfo:    { display: 'flex', flexDirection: 'column', gap: 4 },
  infoItem:    { display: 'flex', justifyContent: 'space-between' },
  infoL:       { fontSize: 11, color: TEXTO_MEIO, fontWeight: 600 },
  infoV:       { fontSize: 12, color: '#1A2340', fontWeight: 600 },
  acoes:       { display: 'flex', gap: 8 },
  btn:         { flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:       { background: '#fff', borderRadius: 16, padding: '24px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' as const },
  modalTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 18, fontWeight: 800, color: '#1A2340' },
  fechar:      { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXTO_MEIO },
  form:        { display: 'flex', flexDirection: 'column', gap: 14 },
  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  secao:       { fontSize: 13, fontWeight: 800, color: TEXTO_MEIO, borderBottom: `1px solid ${CINZA_BORDA}`, paddingBottom: 4 },
  btnGeo:      { background: '#EEF2FF', color: AZUL, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSalvar:   { background: AZUL, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
}
