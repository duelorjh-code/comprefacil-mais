'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, redirecionarPorRole, formatTelefone, limparTelefone } from '@/lib/auth'
import { AZUL, DOURADO, CINZA_BORDA, TEXTO, TEXTO_MEIO, VERMELHO, RODAPE, linkWhats } from '@/lib/constants'

export default function LoginPage() {
  const router = useRouter()
  const [telefone, setTelefone]   = useState('')
  const [senha, setSenha]         = useState('')
  const [erro, setErro]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [tentativas, setTentativas] = useState(0)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  function handleTelefone(v: string) {
    setTelefone(formatTelefone(v))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    const tel = limparTelefone(telefone)
    const email = tel + '@cfm.app' // 🔥 CORREÇÃO AQUI

    if (tel.length < 10) return setErro('Telefone inválido. Inclua o DDD.')
    if (senha.length !== 6) return setErro('A senha deve ter exatamente 6 dígitos.')
    if (tentativas >= 5) return setErro('Muitas tentativas. Fale com o suporte via WhatsApp.')

    setLoading(true)
    const result = await login(email, senha) // 🔥 CORREÇÃO AQUI
    setLoading(false)

    if (!result.sucesso) {
      if (result.erro === 'BLOQUEADO') { router.push('/bloqueado'); return }
      setTentativas(t => t + 1)
      setErro(result.erro ?? 'Erro ao fazer login.')
      return
    }

    const role = result.perfil!.role
    const DATA_INAUGURACAO = new Date('2026-05-08T03:00:00Z')
    const bloqueado = new Date() < DATA_INAUGURACAO && ['cliente', 'entregador'].includes(role)
    if (bloqueado) { router.replace('/inauguracao'); return }
    router.replace(redirecionarPorRole(role))
  }

  return (
    <div style={s.page}>
      <div style={s.bg} />
      <div style={s.orb} />

      <div style={s.card} className="anim-fadeUp">
        <div style={s.logoWrap}>
          <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        </div>

        <div style={s.header}>
          <h1 style={s.titulo}>Bem-vindo de volta</h1>
          <p style={s.subtitulo}>Entre com seu telefone e senha</p>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.campo}>
            <label style={s.label}>Telefone com DDD</label>
            <div style={s.inputWrap}>
              <span style={s.icone}>📱</span>
              <input
                style={s.input}
                type="tel"
                placeholder="(67) 99999-0000"
                value={telefone}
                onChange={e => handleTelefone(e.target.value)}
                maxLength={15}
                required
              />
            </div>
          </div>

          <div style={s.campo}>
            <label style={s.label}>Senha (6 dígitos)</label>
            <div style={s.inputWrap}>
              <span style={s.icone}>🔒</span>
              <input
                style={{ ...s.input, letterSpacing: senha ? '0.3em' : 'normal' }}
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="••••••"
                value={senha}
                onChange={e => setSenha(e.target.value.replace(/\D/g,'').slice(0,6))}
                inputMode="numeric"
                maxLength={6}
                required
              />
              <button type="button" onClick={() => setMostrarSenha(v => !v)} style={s.eyeBtn}>
                {mostrarSenha ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {erro && <p style={s.erro}>{erro}</p>}

          <button type="submit" disabled={loading} style={{ ...s.btnEnviar, opacity: loading ? 0.7 : 1 }}>
            {loading
              ? <span style={s.spinner} className="anim-spin" />
              : 'Entrar'
            }
          </button>
        </form>

        <div style={s.links}>
          <p style={s.linkText}>
            Não tem conta?{' '}
            <button onClick={() => router.push('/cadastro')} style={s.linkBtn}>Cadastre-se</button>
          </p>
          <p style={s.linkText}>
            Esqueceu a senha?{' '}
            <a href={linkWhats('Olá, esqueci minha senha do CompreFácil+.')} target="_blank" rel="noreferrer" style={s.linkBtn}>
              Fale com o suporte
            </a>
          </p>
          {tentativas >= 3 && (
            <p style={s.linkText}>
              Primeiro acesso como parceiro?{' '}
              <button onClick={() => router.push('/parceiro/primeiro-acesso')} style={s.linkBtn}>
                Clique aqui
              </button>
            </p>
          )}
        </div>
      </div>

      <p style={s.rodape}>{RODAPE}</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#F4F6FB', fontFamily: "'Nunito', sans-serif",
    padding: '24px', position: 'relative',
  },
  bg: { position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #EEF2FF 0%, #F4F6FB 100%)', zIndex: 0 },
  orb: {
    position: 'fixed', width: 400, height: 400, borderRadius: '50%',
    background: `${DOURADO}08`, top: -100, right: -100, zIndex: 0, filter: 'blur(60px)',
  },
  card: {
    position: 'relative', zIndex: 1, background: '#fff',
    borderRadius: 20, padding: '32px 28px',
    boxShadow: '0 4px 32px rgba(27,47,94,0.08)',
    width: '100%', maxWidth: 400,
    display: 'flex', flexDirection: 'column', gap: 24,
    border: `1px solid ${CINZA_BORDA}`,
  },
  logoWrap: { display: 'flex', justifyContent: 'center' },
  logo: { height: 44, objectFit: 'contain' },
  header: { textAlign: 'center' as const },
  titulo: { fontSize: 22, fontWeight: 800, color: AZUL, marginBottom: 4 },
  subtitulo: { fontSize: 14, color: TEXTO_MEIO },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  campo: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: TEXTO },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 12,
    padding: '0 14px', background: '#FAFBFE',
  },
  icone: { fontSize: 16 },
  input: {
    flex: 1, border: 'none', background: 'transparent',
    padding: '13px 0', fontSize: 15, color: TEXTO, outline: 'none',
  },
  eyeBtn: {
    background: 'none', border: 'none',
    fontSize: 16, cursor: 'pointer',
  },
  erro: {
    fontSize: 13, color: '#EF4444', fontWeight: 600,
    background: '#FFF1F1', borderRadius: 10, padding: '10px 14px',
  },
  btnEnviar: {
    width: '100%', padding: '15px', background: AZUL,
    color: '#fff', border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 800,
  },
  spinner: {
    width: 20, height: 20, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
  },
  links: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' },
  linkText: { fontSize: 13, color: TEXTO_MEIO },
  linkBtn: {
    background: 'none', border: 'none', color: DOURADO,
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
  rodape: { position: 'fixed', bottom: 16, color: '#aaa', fontSize: 11 },
}