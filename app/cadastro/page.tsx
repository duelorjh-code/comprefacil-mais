'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cadastrarCliente, cadastrarEntregador, formatTelefone, limparTelefone } from '@/lib/auth'
import { AZUL, DOURADO, CINZA_BORDA, TEXTO, TEXTO_MEIO, VERDE, RODAPE } from '@/lib/constants'

type Tipo = 'cliente' | 'entregador'

export default function CadastroPage() {
  const router = useRouter()
  const [tipo, setTipo]         = useState<Tipo>('cliente')
  const [etapa, setEtapa]       = useState<1|2>(1)
  const [nome, setNome]         = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha]       = useState('')
  const [confirma, setConfirma] = useState('')
  const [cpf, setCpf]           = useState('')
  const [veiculo, setVeiculo]   = useState<'moto'|'ebike'>('moto')
  const [arquivo, setArquivo]   = useState<File|null>(null)
  const [nomeArq, setNomeArq]   = useState('')
  const [erro, setErro]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [sucesso, setSucesso]   = useState(false)

  function fmtCpf(v: string) {
    const n = v.replace(/\D/g,'').slice(0,11)
    if (n.length <= 3) return n
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const tel = limparTelefone(telefone)
    if (tel.length < 10) return setErro('Telefone inválido.')
    if (senha.length !== 6) return setErro('Senha deve ter 6 dígitos.')
    if (senha !== confirma) return setErro('As senhas não coincidem.')

    setLoading(true)
    if (tipo === 'cliente') {
      const r = await cadastrarCliente({ nome: nome.trim(), telefone: tel, senha })
      setLoading(false)
      if (!r.sucesso) return setErro(r.erro!)
    } else {
      if (!arquivo) { setLoading(false); return setErro('Envie a foto do documento.') }
      const r = await cadastrarEntregador({
        nome: nome.trim(), telefone: tel,
        cpf: cpf.replace(/\D/g,''), tipo_veiculo: veiculo, senha,
        documento_file: arquivo,
      })
      setLoading(false)
      if (!r.sucesso) return setErro(r.erro!)
    }
    setSucesso(true)
  }

  if (sucesso) return (
    <div style={s.page}>
      <div style={s.card} className="anim-fadeUp">
        <div style={s.sucessoIcon}>✅</div>
        <h2 style={s.titulo}>Cadastro realizado!</h2>
        {tipo === 'entregador'
          ? <p style={s.subtitulo}>Seu cadastro foi enviado para validação. Em breve você receberá uma confirmação.</p>
          : <p style={s.subtitulo}>Conta criada com sucesso. Faça login para começar.</p>
        }
        <button onClick={() => router.push('/login')} style={s.btnPrincipal}>Fazer login</button>
        <p style={s.rodape}>{RODAPE}</p>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.card} className="anim-fadeUp">
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <div style={s.logoWrap}>
          <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        </div>
        <h1 style={s.titulo}>Criar conta</h1>

        {/* Toggle tipo */}
        <div style={s.toggle}>
          {(['cliente','entregador'] as Tipo[]).map(t => (
            <button key={t} onClick={() => { setTipo(t); setEtapa(1) }}
              style={{ ...s.toggleBtn, ...(tipo===t ? s.toggleAtivo : {}) }}>
              {t === 'cliente' ? '🛒 Cliente' : '🛵 Entregador'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          {/* Etapa 1 — dados comuns */}
          <div style={s.campo}>
            <label style={s.label}>Nome completo</label>
            <input style={s.input} type="text" placeholder="Seu nome completo"
              value={nome} onChange={e => setNome(e.target.value)} required />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Telefone com DDD</label>
            <input style={s.input} type="tel" placeholder="(67) 99999-0000"
              value={telefone} onChange={e => setTelefone(formatTelefone(e.target.value))}
              maxLength={15} required />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Senha (6 dígitos)</label>
            <input style={s.input} type="password" placeholder="••••••"
              value={senha} onChange={e => setSenha(e.target.value.replace(/\D/g,'').slice(0,6))}
              inputMode="numeric" maxLength={6} required />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Confirmar senha</label>
            <input style={s.input} type="password" placeholder="••••••"
              value={confirma} onChange={e => setConfirma(e.target.value.replace(/\D/g,'').slice(0,6))}
              inputMode="numeric" maxLength={6} required />
          </div>

          {/* Campos entregador */}
          {tipo === 'entregador' && <>
            <div style={s.campo}>
              <label style={s.label}>CPF</label>
              <input style={s.input} type="text" placeholder="000.000.000-00"
                value={cpf} onChange={e => setCpf(fmtCpf(e.target.value))} maxLength={14} required />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Tipo de veículo</label>
              <div style={s.radioGroup}>
                {(['moto','ebike'] as const).map(v => (
                  <label key={v} style={{ ...s.radioLabel, ...(veiculo===v ? s.radioAtivo : {}) }}>
                    <input type="radio" value={v} checked={veiculo===v}
                      onChange={() => setVeiculo(v)} style={{ display:'none' }} />
                    {v === 'moto' ? '🏍️ Moto' : '⚡ E-Bike'}
                  </label>
                ))}
              </div>
            </div>
            <div style={s.campo}>
              <label style={s.label}>
                {veiculo === 'moto' ? 'Foto da CNH' : 'Foto do RG'}
              </label>
              <label style={s.uploadLabel}>
                <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if(f) { setArquivo(f); setNomeArq(f.name) } }} />
                📎 {nomeArq || 'Selecionar arquivo'}
              </label>
            </div>
          </>}

          {erro && <p style={s.erro}>{erro}</p>}

          <button type="submit" disabled={loading}
            style={{ ...s.btnPrincipal, opacity: loading ? 0.7 : 1 }}>
            {loading ? <span className="anim-spin" style={s.spinner} /> : 'Criar conta'}
          </button>
        </form>

        <p style={s.linkText}>
          Já tem conta?{' '}
          <button onClick={() => router.push('/login')} style={s.linkBtn}>Fazer login</button>
        </p>
        <p style={{ ...s.rodape, position: 'relative', bottom: 'auto', marginTop: 8 }}>{RODAPE}</p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#F4F6FB',
    fontFamily: "'Nunito', sans-serif", padding: '24px',
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '28px 24px',
    boxShadow: '0 4px 32px rgba(27,47,94,0.08)',
    width: '100%', maxWidth: 400,
    display: 'flex', flexDirection: 'column', gap: 18,
    border: `1px solid ${CINZA_BORDA}`,
  },
  voltar: {
    background: 'none', border: 'none', color: TEXTO_MEIO,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    textAlign: 'left' as const, padding: 0, fontFamily: 'inherit',
  },
  logoWrap: { display: 'flex', justifyContent: 'center' },
  logo: { height: 38, objectFit: 'contain' },
  titulo: { fontSize: 20, fontWeight: 800, color: AZUL, textAlign: 'center' as const },
  subtitulo: { fontSize: 14, color: TEXTO_MEIO, textAlign: 'center' as const, lineHeight: 1.6 },
  toggle: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 8, background: '#F4F6FB', borderRadius: 12, padding: 4,
  },
  toggleBtn: {
    padding: '10px', borderRadius: 10, border: 'none',
    background: 'transparent', fontSize: 13, fontWeight: 700,
    color: TEXTO_MEIO, cursor: 'pointer', transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  toggleAtivo: { background: '#fff', color: AZUL, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  campo: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 700, color: TEXTO },
  input: {
    border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10,
    padding: '12px 14px', fontSize: 14, color: TEXTO,
    background: '#FAFBFE', outline: 'none', fontFamily: 'inherit',
  },
  radioGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  radioLabel: {
    padding: '11px', borderRadius: 10, border: `1.5px solid ${CINZA_BORDA}`,
    textAlign: 'center' as const, fontSize: 13, fontWeight: 700,
    color: TEXTO_MEIO, cursor: 'pointer', transition: 'all 0.2s',
  },
  radioAtivo: { borderColor: DOURADO, color: DOURADO, background: '#FDF3D8' },
  uploadLabel: {
    padding: '12px 14px', border: `1.5px dashed ${CINZA_BORDA}`,
    borderRadius: 10, fontSize: 13, color: TEXTO_MEIO,
    cursor: 'pointer', textAlign: 'center' as const, fontWeight: 600,
  },
  erro: {
    fontSize: 13, color: '#EF4444', fontWeight: 600,
    background: '#FFF1F1', borderRadius: 10, padding: '10px 14px',
    border: '1px solid #FEE2E2',
  },
  btnPrincipal: {
    width: '100%', padding: '15px', background: AZUL,
    color: '#fff', border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 800, display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sucessoIcon: { fontSize: 48, textAlign: 'center' as const },
  spinner: {
    width: 20, height: 20, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', display: 'inline-block',
  },
  linkText: { fontSize: 13, color: TEXTO_MEIO, textAlign: 'center' as const },
  linkBtn: {
    background: 'none', border: 'none', color: DOURADO,
    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  rodape: { fontSize: 11, color: '#aaa', textAlign: 'center' as const },
}
