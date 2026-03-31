'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

export default function AdminEntregadores() {
  const [lista, setLista]     = useState<any[]>([])
  const [busca, setBusca]     = useState('')
  const [filtro, setFiltro]   = useState('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const res  = await fetch('/api/admin/entregadores')
    const json = await res.json()
    setLista(json.data ?? [])
    setLoading(false)
  }

  async function toggleOnline(id: string, status: string) {
    const novo = status === 'online' ? 'offline' : 'online'
    await supabase.from('entregadores').update({ status: novo }).eq('id', id)
    carregar()
  }

  async function validar(id: string, val: boolean) {
    await supabase.from('entregadores').update({ validado: val }).eq('id', id)
    carregar()
  }

  async function bloquear(usuarioId: string, bloqueado: boolean) {
    await supabase.from('perfis').update({
      bloqueado: !bloqueado,
      motivo_bloqueio: !bloqueado ? 'Bloqueado pelo Admin.' : null,
    }).eq('id', usuarioId)
    carregar()
  }

  const filtrados = lista.filter(e => {
    const matchBusca = !busca ||
      (e.perfis?.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
      (e.perfis?.telefone ?? '').includes(busca)
    const matchFiltro = filtro === 'todos' ||
      (filtro === 'online'    && e.status === 'online') ||
      (filtro === 'pendente'  && !e.validado) ||
      (filtro === 'bloqueado' && e.perfis?.bloqueado)
    return matchBusca && matchFiltro
  })

  return (
    <div style={s.wrap}>
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Entregadores <span style={s.count}>{lista.length}</span></h1>
        <div style={s.contadores}>
          <span style={{ ...s.countBadge, background: '#22C55E20', color: VERDE }}>{lista.filter(e => e.status === 'online').length} online</span>
          <span style={{ ...s.countBadge, background: '#F59E0B20', color: '#B45309' }}>{lista.filter(e => !e.validado).length} pendentes</span>
        </div>
      </div>

      <input style={s.busca} placeholder="🔍 Buscar por nome ou telefone…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      <div style={s.tabs}>
        {[['todos','Todos'],['online','Online'],['pendente','Pendentes'],['bloqueado','Bloqueados']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)}
            style={{ ...s.tab, ...(filtro === val ? s.tabAtivo : {}) }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: TEXTO_MEIO }}>Carregando...</div>
      ) : (
        <div style={s.grid}>
          {filtrados.map(e => (
            <div key={e.id} style={s.card}>
              <div style={s.cardTop}>
                <div style={s.cardNome}>{e.perfis?.nome ?? '—'}</div>
                <div style={s.pills}>
                  <span style={{ ...s.pill, background: e.status === 'online' ? '#22C55E20' : '#6B728020', color: e.status === 'online' ? VERDE : '#6B7280' }}>
                    {e.status === 'online' ? '● Online' : '○ Offline'}
                  </span>
                  <span style={{ ...s.pill, background: e.validado ? '#3B82F620' : '#F59E0B20', color: e.validado ? '#1D4ED8' : '#B45309' }}>
                    {e.validado ? '✓ Validado' : '⏳ Pendente'}
                  </span>
                  {e.perfis?.bloqueado && (
                    <span style={{ ...s.pill, background: '#FEE2E2', color: '#991B1B' }}>🚫 Bloqueado</span>
                  )}
                </div>
              </div>

              <div style={s.cardSub}>{e.perfis?.telefone} · {e.tipo_veiculo === 'moto' ? '🏍️ Moto' : '⚡ E-Bike'}</div>

              <div style={s.cardInfo}>
                <div style={s.infoItem}><span style={s.infoL}>CPF</span><span style={s.infoV}>{e.cpf}</span></div>
                <div style={s.infoItem}>
                  <span style={s.infoL}>Recusas</span>
                  <span style={{ ...s.infoV, color: (e.perfis?.total_recusas ?? 0) >= 2 ? LARANJA : TEXTO }}>
                    {e.perfis?.total_recusas ?? 0}/3
                  </span>
                </div>
              </div>

              <div style={s.acoes}>
                <button onClick={() => toggleOnline(e.id, e.status)}
                  style={{ ...s.btn, background: e.status === 'online' ? '#EF444420' : '#22C55E20', color: e.status === 'online' ? VERMELHO : VERDE }}>
                  {e.status === 'online' ? '⏸ Forçar Offline' : '▶ Forçar Online'}
                </button>
                {!e.validado
                  ? <button onClick={() => validar(e.id, true)} style={{ ...s.btn, background: '#3B82F620', color: '#1D4ED8' }}>✓ Validar</button>
                  : <button onClick={() => validar(e.id, false)} style={{ ...s.btn, background: '#F59E0B20', color: '#B45309' }}>↩ Revogar</button>
                }
                <button onClick={() => bloquear(e.perfis.id, e.perfis?.bloqueado)}
                  style={{ ...s.btn, background: e.perfis?.bloqueado ? '#22C55E20' : '#EF444420', color: e.perfis?.bloqueado ? VERDE : VERMELHO }}>
                  {e.perfis?.bloqueado ? '✓ Desbloquear' : '🚫 Bloquear'}
                </button>
              </div>
            </div>
          ))}
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
  contadores:  { display: 'flex', gap: 8 },
  countBadge:  { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  busca:       { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: TEXTO, background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' },
  tabs:        { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  tab:         { padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${CINZA_BORDA}`, background: '#fff', fontSize: 12, fontWeight: 700, color: TEXTO_MEIO, cursor: 'pointer', fontFamily: 'inherit' },
  tabAtivo:    { background: AZUL, color: '#fff', borderColor: AZUL },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:        { background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 8px rgba(27,47,94,0.07)', display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardNome:    { fontSize: 15, fontWeight: 800, color: '#1A2340' },
  cardSub:     { fontSize: 12, color: TEXTO_MEIO },
  pills:       { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  pill:        { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' as const },
  cardInfo:    { display: 'flex', flexDirection: 'column', gap: 4 },
  infoItem:    { display: 'flex', justifyContent: 'space-between' },
  infoL:       { fontSize: 11, color: TEXTO_MEIO, fontWeight: 600 },
  infoV:       { fontSize: 12, color: '#1A2340', fontWeight: 600 },
  acoes:       { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  btn:         { flex: 1, padding: '7px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minWidth: 80 },
}
