'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Mensagem {
  id: string; de_id: string; para_id: string
  texto: string; lida: boolean; criado_em: string
}

interface ChatProps {
  paraId: string
  paraNome: string
  meuId: string
}

export default function Chat({ paraId, paraNome, meuId }: ChatProps) {
  const [aberto, setAberto]       = useState(false)
  const [msgs, setMsgs]           = useState<Mensagem[]>([])
  const [texto, setTexto]         = useState('')
  const [enviando, setEnviando]   = useState(false)
  const [naoLidas, setNaoLidas]   = useState(0)
  const fimRef                     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    buscarMensagens()
    // Realtime
    const canal = supabase.channel(`chat-${meuId}-${paraId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensagens',
        filter: `para_id=eq.${meuId}`,
      }, () => buscarMensagens())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [paraId])

  useEffect(() => {
    if (aberto) {
      buscarMensagens()
      fimRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [aberto, msgs.length])

  async function buscarMensagens() {
    const res = await fetch(`/api/chat?para_id=${paraId}`)
    const json = await res.json()
    const lista = json.data ?? []
    setMsgs(lista)
    if (!aberto) {
      setNaoLidas(lista.filter((m: Mensagem) => m.para_id === meuId && !m.lida).length)
    } else {
      setNaoLidas(0)
    }
  }

  async function enviar() {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ para_id: paraId, texto: texto.trim() }),
    })
    setTexto('')
    setEnviando(false)
    buscarMensagens()
  }

  const formatHora = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Campo_Grande' })

  return (
    <>
      {/* Botão flutuante */}
      <button onClick={() => setAberto(v => !v)} style={s.fab}>
        {aberto ? '✕' : '💬'}
        {!aberto && naoLidas > 0 && <span style={s.badge}>{naoLidas}</span>}
      </button>

      {/* Janela de chat */}
      {aberto && (
        <div style={s.janela}>
          {/* Header */}
          <div style={s.header}>
            <div style={s.headerNome}>💬 {paraNome}</div>
            <button onClick={() => setAberto(false)} style={s.fechar}>✕</button>
          </div>

          {/* Mensagens */}
          <div style={s.msgs}>
            {msgs.length === 0 && (
              <div style={s.vazio}>Nenhuma mensagem ainda. Diga olá! 👋</div>
            )}
            {msgs.map(m => {
              const minha = m.de_id === meuId
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: minha ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  <div style={{ ...s.bolha, ...(minha ? s.bolhaMinha : s.bolhaDela) }}>
                    <div style={s.bolhaTexto}>{m.texto}</div>
                    <div style={s.bolhaHora}>{formatHora(m.criado_em)} {minha && (m.lida ? '✓✓' : '✓')}</div>
                  </div>
                </div>
              )
            })}
            <div ref={fimRef} />
          </div>

          {/* Input */}
          <div style={s.inputWrap}>
            <input
              style={s.input}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder="Digite uma mensagem..."
              disabled={enviando}
            />
            <button onClick={enviar} disabled={enviando || !texto.trim()} style={s.btnEnviar}>
              {enviando ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const AZUL = '#1B2F5E'
const s: Record<string, React.CSSProperties> = {
  fab:         { position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: '50%', background: AZUL, color: '#fff', border: 'none', fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  badge:       { position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  janela:      { position: 'fixed', bottom: 84, right: 24, width: 320, height: 440, background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 998, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Nunito', sans-serif" },
  header:      { background: AZUL, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerNome:  { color: '#fff', fontSize: 14, fontWeight: 800 },
  fechar:      { background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 16, cursor: 'pointer' },
  msgs:        { flex: 1, overflowY: 'auto' as const, padding: '12px', display: 'flex', flexDirection: 'column' as const },
  vazio:       { color: '#94A3B8', fontSize: 13, textAlign: 'center' as const, marginTop: 40 },
  bolha:       { maxWidth: '75%', padding: '8px 12px', borderRadius: 12, fontSize: 13 },
  bolhaMinha:  { background: AZUL, color: '#fff', borderBottomRightRadius: 2 },
  bolhaDela:   { background: '#F1F5F9', color: '#1A2340', borderBottomLeftRadius: 2 },
  bolhaTexto:  { lineHeight: 1.4, wordBreak: 'break-word' as const },
  bolhaHora:   { fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' as const },
  inputWrap:   { display: 'flex', padding: '10px', borderTop: '1px solid #F1F5F9', gap: 8 },
  input:       { flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 20, padding: '8px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  btnEnviar:   { width: 36, height: 36, borderRadius: '50%', background: AZUL, color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}
