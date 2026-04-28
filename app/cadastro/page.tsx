'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cadastrarCliente, cadastrarEntregador, formatTelefone, limparTelefone } from '@/lib/auth'
import { AZUL, DOURADO, CINZA_BORDA, TEXTO, TEXTO_MEIO, VERDE, VERMELHO, RODAPE } from '@/lib/constants'

type Tipo = 'cliente' | 'entregador'
type TelaAtual = 'cadastro' | 'pitch' | 'formulario_parceiro' | 'confirmacao_parceiro'

const CATEGORIAS_SISTEMA = [
  { slug: 'bebidas',             nome: 'Bebidas',               emoji: '🍺' },
  { slug: 'conveniencia',        nome: 'Conveniência',           emoji: '🏪' },
  { slug: 'mercearia',           nome: 'Mercearia',              emoji: '🛒' },
  { slug: 'churrasco',           nome: 'Churrasco',              emoji: '🥩' },
  { slug: 'tabacaria',           nome: 'Tabacaria',              emoji: '🚬' },
  { slug: 'bomboniere',          nome: 'Bomboniere',             emoji: '🍬' },
  { slug: 'petiscos',            nome: 'Petiscos',               emoji: '🍿' },
  { slug: 'terere',              nome: 'Tereré',                 emoji: '🧉' },
  { slug: 'padaria',             nome: 'Padaria',                emoji: '🥖' },
  { slug: 'farmacia',            nome: 'Farmácia',               emoji: '💊' },
  { slug: 'pet_shop',            nome: 'Pet Shop',               emoji: '🐾' },
  { slug: 'material_construcao', nome: 'Mat. Construção',        emoji: '🔨' },
]

const PITCH_FRASES = [
  'Bem-vindo ao CompreFácil+.',
  'A plataforma que conecta seu negócio a clientes da sua região.',
  'Sem mensalidade. Sem taxa de adesão.',
  'Você cadastra seus produtos com preço e quantidade.',
  'Quando um cliente comprar, o pedido chega direto para você separar.',
  'Um entregador da nossa rede busca e entrega.',
  'Você recebe o valor das vendas acumulado.',
  'A retirada do seu saldo é simples e rápida.',
  'Seu negócio na vitrine digital da cidade.',
  'Vamos começar?',
]

const VAZIO_PARCEIRO = {
  nome_completo: '', nome_fantasia: '', telefone: '', cnpj_cpf: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  pix_chave: '', pix_tipo: 'cpf',
  horario_abertura: '08:00', horario_fechamento: '22:00',
}

export default function CadastroPage() {
  const router = useRouter()

  // Tela atual
  const [tela, setTela] = useState<TelaAtual>('cadastro')

  // Cadastro cliente/entregador
  const [tipo, setTipo]         = useState<Tipo>('cliente')
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

  // Pitch
  const [fraseIdx, setFraseIdx]   = useState(0)
  const [fraseVis, setFraseVis]   = useState(true)
  const [pitchFim, setPitchFim]   = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Formulário parceiro
  const [formP, setFormP]           = useState({...VAZIO_PARCEIRO})
  const [categoriasSel, setCatSel]  = useState<string[]>([])
  const [loadingCep, setLoadingCep] = useState(false)
  const [erroParceiro, setErroParceiro] = useState('')
  const [loadingP, setLoadingP]     = useState(false)

  // ── Pitch com Google TTS ───────────────────────────────────────
  useEffect(() => {
    if (tela !== 'pitch') return
    setFraseIdx(0)
    setFraseVis(true)
    setPitchFim(false)
  }, [tela])

  useEffect(() => {
    if (tela !== 'pitch') return
    narrarFrase(fraseIdx)
  }, [fraseIdx, tela])

  async function narrarFrase(idx: number) {
    // Para áudio anterior se existir
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: PITCH_FRASES[idx] }),
      })
      const data = await res.json()
      if (!data.audio) throw new Error('sem audio')

      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`)
      audioRef.current = audio
      audio.play()
      audio.onended = () => {
        setTimeout(() => {
          setFraseVis(false)
          setTimeout(() => {
            const prox = idx + 1
            if (prox < PITCH_FRASES.length) {
              setFraseIdx(prox)
              setFraseVis(true)
            } else {
              setPitchFim(true)
            }
          }, 400)
        }, 600)
      }
    } catch {
      // Fallback silencioso — avança após 2.5s
      setTimeout(() => {
        setFraseVis(false)
        setTimeout(() => {
          const prox = idx + 1
          if (prox < PITCH_FRASES.length) {
            setFraseIdx(prox)
            setFraseVis(true)
          } else {
            setPitchFim(true)
          }
        }, 400)
      }, 2500)
    }
  }

  function pularPitch() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPitchFim(true)
  }

  // ── CEP parceiro ───────────────────────────────────────────────
  async function buscarCep(v: string) {
    const c = v.replace(/\D/g, '')
    if (c.length !== 8) return
    setLoadingCep(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json()
      if (!d.erro) setFormP(f => ({ ...f, endereco: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }))
    } finally { setLoadingCep(false) }
  }

  function setP(k: string, v: string) { setFormP(f => ({ ...f, [k]: v })) }

  function toggleCat(slug: string) {
    setCatSel(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])
  }

  function fmtCpf(v: string) {
    const n = v.replace(/\D/g,'').slice(0,14)
    if (n.length <= 11) {
      if (n.length <= 3) return n
      if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`
      if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`
      return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`
    }
    return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`
  }

  // ── Envio formulário parceiro ──────────────────────────────────
  async function handleEnviarParceiro(e: React.FormEvent) {
    e.preventDefault()
    setErroParceiro('')
    if (!formP.nome_completo || !formP.telefone || !formP.cnpj_cpf) {
      return setErroParceiro('Preencha nome, telefone e CPF/CNPJ.')
    }
    if (categoriasSel.length === 0) {
      return setErroParceiro('Selecione pelo menos um ramo de atividade.')
    }
    setLoadingP(true)

    const res = await fetch('/api/parceiro/pre-cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formP, categorias: categoriasSel }),
    })
    const data = await res.json()
    setLoadingP(false)

    if (!res.ok) return setErroParceiro(data.erro ?? 'Erro ao enviar. Tente novamente.')

    // Abre WhatsApp do Admin com notificação
    if (data.linkAdmin) window.open(data.linkAdmin, '_blank')

    setTela('confirmacao_parceiro')
  }

  // ── Envio cliente/entregador ───────────────────────────────────
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

  // ══════════════════════════════════════════════════════════════
  // TELA: CONFIRMAÇÃO PARCEIRO
  // ══════════════════════════════════════════════════════════════
  if (tela === 'confirmacao_parceiro') return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: 'center' as const, gap: 20 }} className="anim-fadeUp">
        <div style={{ fontSize: 56 }}>🎉</div>
        <h2 style={{ ...s.titulo, fontSize: 22 }}>Cadastro recebido!</h2>
        <p style={s.subtitulo}>
          Obrigado pelo seu interesse em ser um Parceiro CompreFácil+.<br /><br />
          Sua solicitação foi enviada com sucesso e nossa equipe irá analisar seus dados.
        </p>
        <div style={s.prazoBox}>
          <div style={{ fontSize: 28 }}>⏱</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: AZUL }}>Prazo de análise</div>
            <div style={{ fontSize: 13, color: TEXTO_MEIO }}>Em até <strong>24 horas úteis</strong> você receberá seu acesso via WhatsApp.</div>
          </div>
        </div>
        <div style={s.pitchBox}>
          <div style={{ fontWeight: 800, fontSize: 13, color: AZUL, marginBottom: 10 }}>📋 O que acontece após a liberação:</div>
          {[
            '1. Acesse o sistema com login e senha que enviaremos',
            '2. Confira seus dados: Nome Fantasia e chave PIX',
            '3. Vá em Estoque → informe o preço e a quantidade de cada produto',
            '4. Produto com preço e quantidade → aparece automaticamente na Vitrine',
            '⚠️ Produto com preço mas quantidade zero = não aparece na Vitrine',
          ].map((item, i) => (
            <div key={i} style={s.pitchItem}>{item}</div>
          ))}
        </div>
        <button onClick={() => router.push('/login')} style={s.btnPrincipal}>
          Ir para o Login
        </button>
        <p style={s.rodape}>{RODAPE}</p>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════
  // TELA: FORMULÁRIO PARCEIRO
  // ══════════════════════════════════════════════════════════════
  if (tela === 'formulario_parceiro') return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 520 }} className="anim-fadeUp">
        <button onClick={() => setTela('pitch')} style={s.voltar}>← Voltar</button>
        <div style={s.logoWrap}>
          <img src="/logo.png" alt="CompreFácil+" style={s.logo} />
        </div>
        <h1 style={s.titulo}>Ficha de Interesse</h1>
        <p style={{ fontSize: 13, color: TEXTO_MEIO, textAlign: 'center' as const, marginTop: -8 }}>
          Preencha os dados abaixo. Nossa equipe entrará em contato em até 24h.
        </p>

        <form onSubmit={handleEnviarParceiro} style={s.form}>

          {/* Dados pessoais */}
          <div style={s.secao}>Dados do Responsável</div>
          <div style={s.grid2}>
            <div style={s.campo}>
              <label style={s.labelF}>Nome completo *</label>
              <input style={s.input} value={formP.nome_completo} onChange={e => setP('nome_completo', e.target.value)} required />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Nome fantasia *</label>
              <input style={s.input} value={formP.nome_fantasia} onChange={e => setP('nome_fantasia', e.target.value)} required />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>CPF / CNPJ *</label>
              <input style={s.input} value={formP.cnpj_cpf} onChange={e => setP('cnpj_cpf', fmtCpf(e.target.value))} required />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Celular com DDD *</label>
              <input style={s.input} value={formP.telefone} placeholder="(67) 99999-0000"
                onChange={e => setP('telefone', formatTelefone(e.target.value))} required />
            </div>
          </div>

          {/* Ramos */}
          <div style={s.secao}>Ramos de Atividade *</div>
          <div style={s.ramosGrid}>
            {CATEGORIAS_SISTEMA.map(cat => {
              const sel = categoriasSel.includes(cat.slug)
              return (
                <button key={cat.slug} type="button" onClick={() => toggleCat(cat.slug)}
                  style={{ ...s.ramoBtn, background: sel ? AZUL : '#F4F6FB', color: sel ? '#fff' : TEXTO_MEIO, borderColor: sel ? AZUL : CINZA_BORDA }}>
                  <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 700 }}>{cat.nome}</span>
                </button>
              )
            })}
          </div>
          {categoriasSel.length > 0 && (
            <div style={{ fontSize: 12, color: AZUL, fontWeight: 700, background: '#EEF2FF', borderRadius: 8, padding: '8px 12px' }}>
              ✅ {categoriasSel.map(sl => CATEGORIAS_SISTEMA.find(c => c.slug === sl)?.nome).join(' + ')}
            </div>
          )}

          {/* Endereço */}
          <div style={s.secao}>Endereço do Estabelecimento</div>
          <div style={s.grid2}>
            <div style={s.campo}>
              <label style={s.labelF}>CEP {loadingCep && '🔄'}</label>
              <input style={s.input} value={formP.cep} placeholder="00000-000"
                onChange={e => { setP('cep', e.target.value); buscarCep(e.target.value) }} />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Endereço</label>
              <input style={s.input} value={formP.endereco} onChange={e => setP('endereco', e.target.value)} />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Número</label>
              <input style={s.input} value={formP.numero} onChange={e => setP('numero', e.target.value)} />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Complemento</label>
              <input style={s.input} value={formP.complemento} onChange={e => setP('complemento', e.target.value)} />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Bairro</label>
              <input style={s.input} value={formP.bairro} onChange={e => setP('bairro', e.target.value)} />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Cidade</label>
              <input style={s.input} value={formP.cidade} onChange={e => setP('cidade', e.target.value)} />
            </div>
          </div>

          {/* Financeiro */}
          <div style={s.secao}>Dados Financeiros (PIX)</div>
          <div style={s.grid2}>
            <div style={s.campo}>
              <label style={s.labelF}>Chave PIX</label>
              <input style={s.input} value={formP.pix_chave} onChange={e => setP('pix_chave', e.target.value)} />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Tipo de Chave</label>
              <select style={s.input} value={formP.pix_tipo} onChange={e => setP('pix_tipo', e.target.value)}>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="telefone">Telefone</option>
                <option value="email">E-mail</option>
                <option value="aleatoria">Chave aleatória</option>
              </select>
            </div>
          </div>

          {erroParceiro && (
            <p style={{ fontSize: 13, color: VERMELHO, background: '#FFF1F1', borderRadius: 10, padding: '10px 14px' }}>
              {erroParceiro}
            </p>
          )}

          <button type="submit" disabled={loadingP} style={{ ...s.btnPrincipal, opacity: loadingP ? 0.7 : 1 }}>
            {loadingP ? 'Enviando...' : '📩 Enviar solicitação'}
          </button>
        </form>

        <p style={{ ...s.rodape, position: 'relative', bottom: 'auto' }}>{RODAPE}</p>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════
  // TELA: PITCH ANIMADO
  // ══════════════════════════════════════════════════════════════
  if (tela === 'pitch') return (
    <div style={s.pagePitch}>
      <div style={s.pitchCard} className="anim-fadeUp">
        <img src="/logo.png" alt="CompreFácil+" style={{ height: 40, objectFit: 'contain', marginBottom: 8 }} />

        {!pitchFim ? (
          <>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{
                ...s.fraseTexto,
                opacity: fraseVis ? 1 : 0,
                transform: fraseVis ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.4s, transform 0.4s',
              }}>
                {PITCH_FRASES[fraseIdx]}
              </p>
            </div>
            <div style={s.dotsWrap}>
              {PITCH_FRASES.map((_, i) => (
                <div key={i} style={{ ...s.dot, background: i === fraseIdx ? '#fff' : 'rgba(255,255,255,0.3)' }} />
              ))}
            </div>
            <button onClick={pularPitch} style={s.btnPular}>Pular apresentação →</button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, flex: 1, justifyContent: 'center' }}>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, textAlign: 'center' as const, lineHeight: 1.5 }}>
              Pronto para fazer parte do CompreFácil+?
            </p>
            <button onClick={() => setTela('formulario_parceiro')} style={s.btnIniciar}>
              Preencher ficha de interesse
            </button>
            <button onClick={() => setTela('cadastro')} style={s.btnPular}>
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════
  // TELA: SUCESSO CLIENTE/ENTREGADOR
  // ══════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════
  // TELA: CADASTRO PRINCIPAL (cliente / entregador / parceiro)
  // ══════════════════════════════════════════════════════════════
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
            <button key={t} onClick={() => { setTipo(t) }}
              style={{ ...s.toggleBtn, ...(tipo===t ? s.toggleAtivo : {}) }}>
              {t === 'cliente' ? '🛒 Cliente' : '🛵 Entregador'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.campo}>
            <label style={s.labelF}>Nome completo</label>
            <input style={s.input} type="text" placeholder="Seu nome completo"
              value={nome} onChange={e => setNome(e.target.value)} required />
          </div>
          <div style={s.campo}>
            <label style={s.labelF}>Telefone com DDD</label>
            <input style={s.input} type="tel" placeholder="(67) 99999-0000"
              value={telefone} onChange={e => setTelefone(formatTelefone(e.target.value))}
              maxLength={15} required />
          </div>
          <div style={s.campo}>
            <label style={s.labelF}>Senha (6 dígitos)</label>
            <input style={s.input} type="password" placeholder="••••••"
              value={senha} onChange={e => setSenha(e.target.value.replace(/\D/g,'').slice(0,6))}
              inputMode="numeric" maxLength={6} required />
          </div>
          <div style={s.campo}>
            <label style={s.labelF}>Confirmar senha</label>
            <input style={s.input} type="password" placeholder="••••••"
              value={confirma} onChange={e => setConfirma(e.target.value.replace(/\D/g,'').slice(0,6))}
              inputMode="numeric" maxLength={6} required />
          </div>

          {tipo === 'entregador' && <>
            <div style={s.campo}>
              <label style={s.labelF}>CPF</label>
              <input style={s.input} type="text" placeholder="000.000.000-00"
                value={cpf} onChange={e => setCpf(e.target.value)} maxLength={14} required />
            </div>
            <div style={s.campo}>
              <label style={s.labelF}>Tipo de veículo</label>
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
              <label style={s.labelF}>{veiculo === 'moto' ? 'Foto da CNH' : 'Foto do RG'}</label>
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

        {/* Botão Seja um Parceiro */}
        <div style={s.divider}>
          <span style={s.dividerText}>ou</span>
        </div>
        <button onClick={() => setTela('pitch')} style={s.btnParceiro}>
          🏪 Seja um Parceiro CompreFácil+
        </button>

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
  pagePitch: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: AZUL,
    fontFamily: "'Nunito', sans-serif", padding: '24px',
  },
  pitchCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 24, width: '100%', maxWidth: 420, minHeight: 360,
    padding: '40px 24px',
  },
  fraseTexto: {
    color: '#fff', fontSize: 22, fontWeight: 700,
    textAlign: 'center' as const, lineHeight: 1.6,
    maxWidth: 340,
  },
  dotsWrap:  { display: 'flex', gap: 8 },
  dot:       { width: 8, height: 8, borderRadius: '50%', transition: 'background 0.3s' },
  btnPular:  { background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
  btnIniciar:{ background: DOURADO, color: '#fff', border: 'none', borderRadius: 12, padding: '14px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
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
  logo:     { height: 38, objectFit: 'contain' },
  titulo:   { fontSize: 20, fontWeight: 800, color: AZUL, textAlign: 'center' as const, margin: 0 },
  subtitulo:{ fontSize: 14, color: TEXTO_MEIO, textAlign: 'center' as const, lineHeight: 1.6 },
  toggle: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 8, background: '#F4F6FB', borderRadius: 12, padding: 4,
  },
  toggleBtn: {
    padding: '10px', borderRadius: 10, border: 'none',
    background: 'transparent', fontSize: 13, fontWeight: 700,
    color: TEXTO_MEIO, cursor: 'pointer', fontFamily: 'inherit',
  },
  toggleAtivo: { background: '#fff', color: AZUL, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  form:   { display: 'flex', flexDirection: 'column', gap: 14 },
  grid2:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  secao:  { fontSize: 12, fontWeight: 800, color: TEXTO_MEIO, textTransform: 'uppercase' as const, borderBottom: `1px solid ${CINZA_BORDA}`, paddingBottom: 4, marginTop: 4 },
  campo:  { display: 'flex', flexDirection: 'column', gap: 5 },
  labelF: { fontSize: 12, fontWeight: 700, color: TEXTO },
  input: {
    border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10,
    padding: '12px 14px', fontSize: 14, color: TEXTO,
    background: '#FAFBFE', outline: 'none', fontFamily: 'inherit',
  },
  radioGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  radioLabel: {
    padding: '11px', borderRadius: 10, border: `1.5px solid ${CINZA_BORDA}`,
    textAlign: 'center' as const, fontSize: 13, fontWeight: 700,
    color: TEXTO_MEIO, cursor: 'pointer',
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
    border: '1px solid #FEE2E2', margin: 0,
  },
  btnPrincipal: {
    width: '100%', padding: '15px', background: AZUL,
    color: '#fff', border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 800, display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnParceiro: {
    width: '100%', padding: '14px', background: DOURADO,
    color: '#fff', border: 'none', borderRadius: 12,
    fontSize: 14, fontWeight: 800, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  dividerText: {
    fontSize: 12, color: TEXTO_MEIO, fontWeight: 600,
    background: '#fff', padding: '0 8px',
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
  // Parceiro forms
  ramosGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  ramoBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '10px 6px', borderRadius: 10, border: '1.5px solid',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
  },
  prazoBox: {
    display: 'flex', gap: 16, alignItems: 'center',
    background: '#EEF2FF', borderRadius: 14, padding: '16px 20px',
    textAlign: 'left' as const,
  },
  pitchBox: {
    background: '#F4F6FB', borderRadius: 14, padding: '16px 20px',
    display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' as const,
    width: '100%',
  },
  pitchItem: { fontSize: 13, color: TEXTO_MEIO, lineHeight: 1.5 },
}
