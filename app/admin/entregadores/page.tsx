'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

export default function AdminEntregadores() {
  const [lista, setLista]   = useState<any[]>([])
  const [busca, setBusca]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase
      .from('entregadores')
      .select(`id, cpf, tipo_veiculo, status, validado, saldo, documento_url, criado_em,
               perfis ( nome, telefone, bloqueado, total_recusas )`)
      .order('criado_em', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }

  async function validar(id: string, val: boolean) {
    await supabase.from('entregadores').update({ validado: val }).eq('id', id)
    carregar()
  }

  async function bloquear(usuarioId: string, bloquear: boolean) {
    await supabase.from('perfis').update({
      bloqueado: bloquear,
      motivo_bloqueio: bloquear ? 'Bloqueado pelo Admin.' : null,
    }).eq('id', usuarioId)
    carregar()
  }

  const filtrados = lista.filter(e =>
    !busca ||
    (e.perfis?.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (e.perfis?.telefone ?? '').includes(busca)
  )

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <h1 style={s.titulo}>Entregadores</h1>
      <input style={s.busca} placeholder="🔍  Buscar por nome ou telefone…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.lista}>
          {filtrados.map(e => (
            <div key={e.id} style={s.card}>
              <div style={s.cardTop}>
                <div>
                  <div style={s.nome}>{e.perfis?.nome}</div>
                  <div style={s.sub}>{e.perfis?.telefone} · {e.tipo_veiculo === 'moto' ? '🏍️ Moto' : '⚡ E-Bike'}</div>
                </div>
                <div style={s.pills}>
                  <span style={{ ...s.pill, background: e.status === 'online' ? '#22C55E20' : '#6B728020', color: e.status === 'online' ? VERDE : '#6B7280' }}>
                    {e.status === 'online' ? '● Online' : '○ Offline'}
                  </span>
                  <span style={{ ...s.pill, background: e.validado ? '#3B82F620' : '#F59E0B20', color: e.validado ? '#3B82F6' : '#F59E0B' }}>
                    {e.validado ? '✓ Validado' : '⏳ Pendente'}
                  </span>
                  {e.perfis?.bloqueado && (
                    <span style={{ ...s.pill, background: '#EF444420', color: VERMELHO }}>🚫 Bloqueado</span>
                  )}
                </div>
              </div>

              <div style={s.info}>
                <div style={s.infoItem}><span style={s.infoL}>CPF</span><span style={s.infoV}>{e.cpf}</span></div>
                <div style={s.infoItem}><span style={s.infoL}>Recusas</span><span style={{ ...s.infoV, color: (e.perfis?.total_recusas ?? 0) >= 2 ? LARANJA : TEXTO }}>{e.perfis?.total_recusas ?? 0}/3</span></div>
                <div style={s.infoItem}><span style={s.infoL}>Saldo</span><span style={{ ...s.infoV, color: AZUL, fontWeight:800 }}>R$ {e.saldo?.toFixed(2)}</span></div>
                {e.documento_url && (
                  <div style={s.infoItem}>
                    <span style={s.infoL}>Documento</span>
                    <a href={e.documento_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color: AZUL, fontWeight:700 }}>Ver doc 📄</a>
                  </div>
                )}
              </div>

              <div style={s.acoes}>
                {!e.validado
                  ? <button onClick={() => validar(e.id, true)} style={{ ...s.btn, background:'#3B82F620', color:'#3B82F6' }}>✓ Validar</button>
                  : <button onClick={() => validar(e.id, false)} style={{ ...s.btn, background:'#F59E0B20', color:'#F59E0B' }}>↩ Revogar</button>
                }
                {!e.perfis?.bloqueado
                  ? <button onClick={() => bloquear(e.perfis.id, true)} style={{ ...s.btn, background:'#EF444420', color: VERMELHO }}>🚫 Bloquear</button>
                  : <button onClick={() => bloquear(e.perfis.id, false)} style={{ ...s.btn, background:'#22C55E20', color: VERDE }}>✓ Desbloquear</button>
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:20 },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  busca: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, background:'#fff', outline:'none', fontFamily:'inherit', color:TEXTO, width:'100%' },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:32, height:32, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  lista: { display:'flex', flexDirection:'column', gap:12 },
  card: { background:'#fff', borderRadius:14, padding:'18px', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column', gap:12 },
  cardTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap' as const, gap:8 },
  nome: { fontSize:15, fontWeight:800, color:TEXTO },
  sub: { fontSize:12, color:TEXTO_MEIO, marginTop:2 },
  pills: { display:'flex', gap:6, flexWrap:'wrap' as const },
  pill: { fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 },
  info: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px 16px' },
  infoItem: { display:'flex', flexDirection:'column', gap:2 },
  infoL: { fontSize:10, color:TEXTO_MEIO, fontWeight:600, textTransform:'uppercase' as const },
  infoV: { fontSize:13, color:TEXTO, fontWeight:600 },
  acoes: { display:'flex', gap:8 },
  btn: { padding:'8px 14px', borderRadius:8, border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
}
