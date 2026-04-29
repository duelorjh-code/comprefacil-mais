'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'
import { useCidade } from '@/lib/cidade-context'

export default function AdminClientes() {
  const { cidade, suffix } = useCidade()
  const [clientes, setClientes] = useState<any[]>([])
  const [busca, setBusca]       = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => { carregar() }, [cidade])

  async function carregar() {
    const res  = await fetch(`/api/admin/clientes?cidade=${cidade}`)
    const json = await res.json()
    setClientes(json.data ?? [])
    setLoading(false)
  }

  async function toggleBloqueio(usuarioId: string, bloqueado: boolean) {
    await supabase.from(`perfis${suffix}`).update({
      bloqueado: !bloqueado,
      motivo_bloqueio: !bloqueado ? 'Bloqueado pelo Admin.' : null,
    }).eq('id', usuarioId)
    carregar()
  }

  async function resetarSenha(telefone: string) {
    const tel = (telefone ?? '').replace(/\D/g, '')
    if (!tel) return alert('Telefone não encontrado.')
    const nova = prompt(`Nova senha para ${telefone} (mínimo 6 dígitos):`)
    if (!nova || nova.length < 6) return alert('Senha inválida.')
    const res = await fetch('/api/admin/resetar-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: tel, nova_senha: nova }),
    })
    const data = await res.json()
    if (data.erro) alert('Erro: ' + data.erro)
    else alert('Senha alterada com sucesso!')
  }

  const filtrados = clientes.filter(c => {
    if (!busca) return true
    const nome = c.perfis?.nome?.toLowerCase() ?? ''
    const tel  = c.perfis?.telefone ?? ''
    return nome.includes(busca.toLowerCase()) || tel.includes(busca)
  })

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Clientes <span style={s.count}>{clientes.length}</span></h1>
        <p style={s.sub}>Histórico de uso e gastos</p>
      </div>

      <input style={s.busca} placeholder="🔍  Buscar por nome ou telefone…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : filtrados.length === 0 ? (
        <div style={s.vazio}>
          <div style={{ fontSize: 48 }}>👤</div>
          <p style={{ fontWeight: 700, color: TEXTO_MEIO }}>Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {filtrados.map(c => {
            const pedidos   = c.pedidos ?? []
            const entregues = pedidos.filter((p: any) => p.status === 'entregue')
            const totalGasto = entregues.reduce((a: number, p: any) => a + (p.total ?? 0), 0)
            const ultimoPed  = pedidos.sort((a: any, b: any) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())[0]
            const bloqueado  = c.perfis?.bloqueado ?? false
            const inicial    = (c.perfis?.nome ?? '?')[0].toUpperCase()

            return (
              <div key={c.id} style={{ ...s.card, border: bloqueado ? `1.5px solid #EF4444` : `1.5px solid ${CINZA_BORDA}` }}>
                <div style={s.cardTop}>
                  <div style={s.avatar}>{inicial}</div>
                  <div style={{ flex: 1 }}>
                    <div style={s.cardNome}>{c.perfis?.nome ?? '—'}</div>
                    <div style={s.cardTel}>{c.perfis?.telefone ?? '—'}</div>
                  </div>
                  {bloqueado && (
                    <span style={{ ...s.pill, background: '#FEE2E2', color: '#991B1B' }}>🚫 Bloqueado</span>
                  )}
                </div>

                <div style={s.stats}>
                  <div style={s.stat}>
                    <div style={s.statValor}>{formatBRL(totalGasto)}</div>
                    <div style={s.statLabel}>Total gasto</div>
                  </div>
                  <div style={s.statDivider} />
                  <div style={s.stat}>
                    <div style={s.statValor}>{entregues.length}</div>
                    <div style={s.statLabel}>Pedidos</div>
                  </div>
                  <div style={s.statDivider} />
                  <div style={s.stat}>
                    <div style={s.statValor}>{pedidos.filter((p: any) => p.status === 'cancelado').length}</div>
                    <div style={s.statLabel}>Cancelados</div>
                  </div>
                </div>

                {ultimoPed && (
                  <div style={s.ultimoPed}>
                    <span style={{ fontSize: 11, color: TEXTO_MEIO }}>Último pedido:</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TEXTO }}>
                      {new Date(ultimoPed.criado_em).toLocaleDateString('pt-BR')} · {formatBRL(ultimoPed.total)}
                    </span>
                  </div>
                )}

                <div style={s.membro}>
                  <span style={{ fontSize: 11, color: TEXTO_MEIO }}>
                    Membro desde {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <div style={s.acoes}>
                  <button onClick={() => resetarSenha(c.perfis?.telefone)}
                    style={{ ...s.btn, background: '#EEF2FF', color: AZUL }}>
                    🔑 Resetar senha
                  </button>
                  <button onClick={() => toggleBloqueio(c.usuario_id ?? c.perfis?.id, bloqueado)}
                    style={{ ...s.btn, background: bloqueado ? '#22C55E20' : '#EF444420', color: bloqueado ? VERDE : VERMELHO }}>
                    {bloqueado ? '✅ Desbloquear' : '🚫 Bloquear'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 20 },
  cabecalho:   { display: 'flex', flexDirection: 'column', gap: 2 },
  titulo:      { fontSize: 22, fontWeight: 800, color: TEXTO, margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  count:       { fontSize: 14, fontWeight: 600, color: TEXTO_MEIO, background: '#F4F6FB', padding: '2px 10px', borderRadius: 20 },
  sub:         { fontSize: 13, color: TEXTO_MEIO },
  busca:       { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, background: '#fff', outline: 'none', fontFamily: 'inherit', color: TEXTO },
  loading:     { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:     { width: 28, height: 28, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  vazio:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:        { background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop:     { display: 'flex', alignItems: 'center', gap: 12 },
  avatar:      { width: 44, height: 44, borderRadius: '50%', background: AZUL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, flexShrink: 0 },
  cardNome:    { fontSize: 15, fontWeight: 800, color: TEXTO },
  cardTel:     { fontSize: 12, color: TEXTO_MEIO, marginTop: 2 },
  pill:        { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' as const },
  stats:       { display: 'flex', alignItems: 'center', background: '#F4F6FB', borderRadius: 10, padding: '10px 0' },
  stat:        { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statValor:   { fontSize: 15, fontWeight: 800, color: AZUL },
  statLabel:   { fontSize: 10, fontWeight: 600, color: TEXTO_MEIO, textTransform: 'uppercase' as const },
  statDivider: { width: 1, height: 28, background: CINZA_BORDA },
  ultimoPed:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F4F6FB', borderRadius: 8, padding: '8px 12px' },
  membro:      { display: 'flex', justifyContent: 'center' },
  acoes:       { display: 'flex', gap: 8 },
  btn:         { flex: 1, padding: '9px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const },
}
