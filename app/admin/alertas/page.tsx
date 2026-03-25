'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

const TIPO_CONFIG: Record<string, { cor: string; icone: string }> = {
  sla_vencido:          { cor: VERMELHO, icone: '⏱️' },
  bloqueio_automatico:  { cor: LARANJA,  icone: '🚫' },
  pedido_sem_entregador:{ cor: '#8B5CF6', icone: '🛵' },
  pix_expirado:         { cor: '#6B7280', icone: '💸' },
  default:              { cor: AZUL,      icone: '🔔' },
}

export default function AdminAlertas() {
  const [alertas, setAlertas] = useState<any[]>([])
  const [filtro, setFiltro]   = useState<'abertos'|'resolvidos'>('abertos')
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [filtro])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('alertas_admin')
      .select('*')
      .eq('resolvido', filtro === 'resolvidos')
      .order('criado_em', { ascending: false })
      .limit(100)
    setAlertas(data ?? [])
    setLoading(false)
  }

  async function resolver(id: string) {
    await supabase.from('alertas_admin').update({ resolvido: true }).eq('id', id)
    setAlertas(a => a.filter(x => x.id !== id))
  }

  async function resolverTodos() {
    await supabase.from('alertas_admin').update({ resolvido: true }).eq('resolvido', false)
    carregar()
  }

  function cfg(tipo: string) { return TIPO_CONFIG[tipo] ?? TIPO_CONFIG.default }

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <h1 style={s.titulo}>Alertas</h1>
        {filtro === 'abertos' && alertas.length > 0 && (
          <button onClick={resolverTodos} style={s.btnTodos}>✓ Resolver todos</button>
        )}
      </div>

      <div style={s.tabs}>
        {(['abertos','resolvidos'] as const).map(t => (
          <button key={t} onClick={() => setFiltro(t)}
            style={{ ...s.tab, ...(filtro===t ? s.tabAtivo : {}) }}>
            {t === 'abertos' ? '🔔 Abertos' : '✓ Resolvidos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : alertas.length === 0 ? (
        <div style={s.vazio}>
          <div style={{ fontSize: 48 }}>{filtro === 'abertos' ? '✅' : '📋'}</div>
          <p>{filtro === 'abertos' ? 'Nenhum alerta aberto. Tudo certo!' : 'Nenhum alerta resolvido.'}</p>
        </div>
      ) : (
        <div style={s.lista}>
          {alertas.map(a => {
            const c = cfg(a.tipo)
            return (
              <div key={a.id} style={{ ...s.card, borderLeft: `3px solid ${c.cor}` }}>
                <div style={s.cardTop}>
                  <span style={s.icone}>{c.icone}</span>
                  <div style={s.cardBody}>
                    <div style={s.cardTipo}>{a.tipo.replace(/_/g,' ')}</div>
                    <div style={s.cardDesc}>{a.descricao}</div>
                    <div style={s.cardHora}>
                      {new Date(a.criado_em).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  {!a.resolvido && (
                    <button onClick={() => resolver(a.id)} style={s.btnResolver}>
                      ✓ Resolver
                    </button>
                  )}
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
  wrap: { display:'flex', flexDirection:'column', gap:20 },
  cabecalho: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  btnTodos: { background:'#22C55E20', color:VERDE, border:'none', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  tabs: { display:'flex', gap:8 },
  tab: { padding:'9px 18px', borderRadius:10, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit' },
  tabAtivo: { background:AZUL, color:'#fff', borderColor:AZUL },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:32, height:32, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  vazio: { textAlign:'center' as const, padding:'60px 20px', color:TEXTO_MEIO, display:'flex', flexDirection:'column', alignItems:'center', gap:12 },
  lista: { display:'flex', flexDirection:'column', gap:10 },
  card: { background:'#fff', borderRadius:12, padding:'16px', boxShadow:'0 1px 8px rgba(27,47,94,0.06)' },
  cardTop: { display:'flex', alignItems:'flex-start', gap:12 },
  icone: { fontSize:22, flexShrink:0, lineHeight:1 },
  cardBody: { flex:1 },
  cardTipo: { fontSize:13, fontWeight:800, color:TEXTO, textTransform:'capitalize' as const },
  cardDesc: { fontSize:13, color:TEXTO_MEIO, marginTop:2, lineHeight:1.5 },
  cardHora: { fontSize:11, color:TEXTO_MEIO, marginTop:6 },
  btnResolver: { background:'#22C55E20', color:VERDE, border:'none', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0 },
}
