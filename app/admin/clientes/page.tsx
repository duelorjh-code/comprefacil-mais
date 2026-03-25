'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

export default function AdminClientes() {
  const [lista, setLista]   = useState<any[]>([])
  const [busca, setBusca]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase
      .from('clientes')
      .select(`id, criado_em, perfis ( id, nome, telefone, bloqueado, motivo_bloqueio )`)
      .order('criado_em', { ascending: false })
    setLista(data ?? [])
    setLoading(false)
  }

  async function toggleBloquear(pId: string, atual: boolean) {
    await supabase.from('perfis').update({
      bloqueado: !atual,
      motivo_bloqueio: !atual ? 'Bloqueado pelo Admin.' : null,
    }).eq('id', pId)
    carregar()
  }

  const filtrados = lista.filter(c =>
    !busca ||
    (c.perfis?.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (c.perfis?.telefone ?? '').includes(busca)
  )

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Clientes</h1>
        <span style={s.total}>{lista.length} cadastrados</span>
      </div>
      <input style={s.busca} placeholder="🔍  Buscar por nome ou telefone…"
        value={busca} onChange={e => setBusca(e.target.value)} />

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.tabela}>
          <div style={s.thead}>
            <span style={{ flex:2 }}>Nome</span>
            <span style={{ flex:1 }}>Telefone</span>
            <span style={{ width:90, textAlign:'center' as const }}>Status</span>
            <span style={{ width:80, textAlign:'center' as const }}>Ação</span>
          </div>
          {filtrados.map(c => (
            <div key={c.id} style={s.row}>
              <span style={{ flex:2, fontSize:14, fontWeight:700, color:TEXTO }}>{c.perfis?.nome}</span>
              <span style={{ flex:1, fontSize:13, color:TEXTO_MEIO }}>{c.perfis?.telefone}</span>
              <span style={{ width:90, textAlign:'center' as const }}>
                <span style={{ ...s.pill, background: c.perfis?.bloqueado ? '#EF444420' : '#22C55E20', color: c.perfis?.bloqueado ? VERMELHO : VERDE }}>
                  {c.perfis?.bloqueado ? 'Bloqueado' : 'Ativo'}
                </span>
              </span>
              <div style={{ width:80, display:'flex', justifyContent:'center' }}>
                <button onClick={() => toggleBloquear(c.perfis.id, c.perfis?.bloqueado)}
                  style={{ ...s.btn, color: c.perfis?.bloqueado ? VERDE : VERMELHO }}>
                  {c.perfis?.bloqueado ? 'Desbloquear' : 'Bloquear'}
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
  wrap: { display:'flex', flexDirection:'column', gap:20 },
  cabecalho: { display:'flex', alignItems:'center', gap:12 },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  total: { fontSize:13, color:TEXTO_MEIO, fontWeight:600, background:'#F4F6FB', padding:'4px 12px', borderRadius:20 },
  busca: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, background:'#fff', outline:'none', fontFamily:'inherit', color:TEXTO, width:'100%' },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:32, height:32, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  tabela: { background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 8px rgba(27,47,94,0.06)' },
  thead: { display:'flex', alignItems:'center', padding:'12px 18px', background:'#F4F6FB', fontSize:11, fontWeight:700, color:TEXTO_MEIO, textTransform:'uppercase' as const, gap:12 },
  row: { display:'flex', alignItems:'center', padding:'14px 18px', borderTop:`1px solid ${CINZA_BORDA}`, gap:12 },
  pill: { fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, display:'inline-block' },
  btn: { background:'none', border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
}
