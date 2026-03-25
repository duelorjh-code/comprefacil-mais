'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { primeiroAcessoParceiro, formatTelefone, limparTelefone } from '@/lib/auth'
import { AZUL, DOURADO, CINZA_BORDA, TEXTO, TEXTO_MEIO, RODAPE } from '@/lib/constants'

export default function PrimeiroAcessoPage() {
  const router = useRouter()
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha]       = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [sucesso, setSucesso]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const tel = limparTelefone(telefone)
    if (tel.length < 10)       return setErro('Telefone inválido.')
    if (senha.length !== 6)    return setErro('Senha deve ter 6 dígitos.')
    if (senha !== confirma)    return setErro('As senhas não coincidem.')

    setLoading(true)
    const r = await primeiroAcessoParceiro(tel, senha)
    setLoading(false)
    if (!r.sucesso) return setErro(r.erro!)
    setSucesso(true)
  }

  if (sucesso) return (
    <div style={s.page}>
      <div style={s.card}>
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        <div style={{ fontSize: 48, textAlign: 'center' as const }}>✅</div>
        <h2 style={s.titulo}>Senha definida!</h2>
        <p style={{ fontSize: 14, color: TEXTO_MEIO, textAlign: 'center' as const }}>
          Agora você pode acessar seu painel normalmente.
        </p>
        <button onClick={() => router.push('/login')} style={s.btnPrincipal}>Fazer login</button>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.card} className="anim-fadeUp">
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        <h1 style={s.titulo}>Primeiro acesso</h1>
        <p style={{ fontSize: 13, color: TEXTO_MEIO, textAlign: 'center' as const }}>
          Informe o telefone cadastrado pelo Admin e defina sua senha.
        </p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.campo}>
            <label style={s.label}>Telefone cadastrado</label>
            <input style={s.input} type="tel" placeholder="(67) 99999-0000"
              value={telefone} onChange={e => setTelefone(formatTelefone(e.target.value))} maxLength={15} required />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Nova senha (6 dígitos)</label>
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
          {erro && <p style={s.erro}>{erro}</p>}
          <button type="submit" disabled={loading} style={{ ...s.btnPrincipal, opacity: loading ? 0.7 : 1 }}>
            {loading ? <span className="anim-spin" style={s.spinner} /> : 'Definir senha'}
          </button>
        </form>
        <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center' as const }}>{RODAPE}</p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FB', fontFamily: "'Nunito', sans-serif", padding: 24 },
  card: { background: '#fff', borderRadius: 20, padding: '28px 24px', boxShadow: '0 4px 32px rgba(27,47,94,0.08)', width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 18, border: `1px solid ${CINZA_BORDA}` },
  voltar: { background: 'none', border: 'none', color: TEXTO_MEIO, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' as const, padding: 0, fontFamily: 'inherit' },
  logo: { height: 38, objectFit: 'contain', display: 'block', margin: '0 auto' },
  titulo: { fontSize: 20, fontWeight: 800, color: AZUL, textAlign: 'center' as const },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  campo: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 700, color: TEXTO },
  input: { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, color: TEXTO, background: '#FAFBFE', outline: 'none', fontFamily: 'inherit' },
  erro: { fontSize: 13, color: '#EF4444', fontWeight: 600, background: '#FFF1F1', borderRadius: 10, padding: '10px 14px', border: '1px solid #FEE2E2' },
  btnPrincipal: { width: '100%', padding: '15px', background: AZUL, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit' },
  spinner: { width: 20, height: 20, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block' },
}
