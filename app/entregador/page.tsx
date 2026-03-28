'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

export default function EntregadorPage() {
  const router = useRouter()
  const [entId, setEntId]         = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [pedidos, setPedidos]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState<string | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [codigo, setCodigo]       = useState('')
  const [modalCodigo, setModalCodigo] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const tocarAlarme = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio('/sons/alerta.mp3')
    audioRef.current.play().catch(() => {})
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUsuarioId(user.id)
      const { data: e } = await supabase.from('entregadores').select('id').eq('usuario_id', user.id).single()
      if (!e) return
      setEntId(e.id)
      await carregar(e.id)

      supabase.channel('ent-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
          carregar(e.id); tocarAlarme()
        })
        .subscribe()
    }
    init()
  }, [tocarAlarme])

  async function carregar(eid: string) {
    const { data } = await supabase.from('pedidos')
      .select(`
        id, status, total, taxa_entrega, distancia_km, endereco_entrega, codigo_confirmacao,
        pedido_itens ( quantidade, produtos ( nome ) ),
        parceiros ( nome_fantasia, endereco, numero, lat, lng ),
        clientes ( perfis ( nome, telefone ) )
      `)
      .or(`status.eq.pronto,and(entregador_id.eq.${eid},status.eq.a_caminho)`)
      .order('criado_em', { ascending: false })
    setPedidos(data ?? [])
    setLoading(false)
  }

  async function aceitar(pedidoId: string) {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async pos => {
      await supabase.from('entregadores')
        .update({ lat_atual: pos.coords.latitude, lng_atual: pos.coords.longitude })
        .eq('id', entId)
      await supabase.from('pedidos')
        .update({ entregador_id: entId, status: 'a_caminho' })
        .eq('id', pedidoId)
      carregar(entId)
    })
  }

  async function recusar(pedidoId: string, just?: string) {
    if (!just) {
      await supabase.rpc('fn_incrementar_recusas_entregador', { p_usuario_id: usuarioId }).then(() => {}).catch(() => {})
    }
    setModal(null)
    setJustificativa('')
    carregar(entId)
  }

  async function confirmarEntrega(pedidoId: string, codigoPedido: string) {
    if (codigo !== codigoPedido) {
      return alert('Código incorreto. Peça ao cliente os 4 últimos dígitos do telefone dele.')
    }
    await supabase.from('pedidos').update({ status: 'entregue' }).eq('id', pedidoId)
    setModalCodigo(null)
    setCodigo('')
    carregar(entId)
  }

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <h1 style={s.titulo}>Entregas</h1>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : pedidos.length === 0 ? (
        <div style={s.vazio}>
          <div style={{ fontSize: 48 }}>🛵</div>
          <p style={{ fontWeight: 700, color: TEXTO }}>Nenhuma entrega no momento</p>
          <p style={{ fontSize: 13, color: TEXTO_MEIO }}>Fique online para receber alertas de novos pedidos.</p>
        </div>
      ) : (
        <div style={s.lista}>
          {pedidos.map(p => (
            <div key={p.id} style={{ ...s.card, ...(p.status === 'pronto' ? s.cardNovo : {}) }}>
              {p.status === 'pronto' && (
                <div style={s.novoBadge} className="anim-blink">🔔 Nova entrega disponível</div>
              )}

              <div style={s.cardTop}>
                <span style={s.id}>#{p.id.slice(0, 8).toUpperCase()}</span>
                <span style={{
                  ...s.pill,
                  background: p.status === 'a_caminho' ? DOURADO + '20' : '#22C55E20',
                  color: p.status === 'a_caminho' ? DOURADO : VERDE,
                }}>
                  {p.status === 'pronto' ? 'Aguardando' : 'A caminho'}
                </span>
              </div>

              <div style={s.info}>
                <div style={s.infoItem}>
                  <span style={s.infoL}>Destino</span>
                  <span style={s.infoV}>{p.endereco_entrega}</span>
                </div>
                <div style={s.infoItem}>
                  <span style={s.infoL}>Retirar em</span>
                  <span style={s.infoV}>{p.parceiros?.endereco ?? '—'}, {p.parceiros?.numero ?? ''}</span>
                </div>
                <div style={s.infoItem}>
                  <span style={s.infoL}>Cliente</span>
                  <span style={s.infoV}>{p.clientes?.perfis?.nome ?? '—'}</span>
                </div>
                <div style={s.infoItem}>
                  <span style={s.infoL}>Distância</span>
                  <span style={s.infoV}>{p.distancia_km ? `${p.distancia_km}km · ~${Math.round(p.distancia_km * 4 + 10)}min` : '—'}</span>
                </div>
                <div style={s.infoItem}>
                  <span style={s.infoL}>Sua taxa</span>
                  <span style={{ ...s.infoV, color: VERDE, fontWeight: 800 }}>{formatBRL(p.taxa_entrega ?? 6)}</span>
                </div>
              </div>

              <div style={s.itens}>
                {(p.pedido_itens ?? []).map((it: any, i: number) => (
                  <span key={i} style={s.itemTag}>{it.quantidade}× {it.produtos?.nome}</span>
                ))}
              </div>

              <div style={s.acoes}>
                {p.status === 'pronto' && <>
                  <button onClick={() => aceitar(p.id)} style={{ ...s.btn, background: AZUL, color: '#fff' }}>
                    ✓ Aceitar entrega
                  </button>
                  <button onClick={() => setModal(p.id)} style={{ ...s.btn, background: '#EF444420', color: VERMELHO }}>
                    ✕ Recusar
                  </button>
                </>}
                {p.status === 'a_caminho' && <>
                  <button onClick={() => router.push('/entregador/mapa')} style={{ ...s.btn, background: '#EEF2FF', color: AZUL }}>
                    🗺️ Ver mapa
                  </button>
                  <a href={`tel:${p.clientes?.perfis?.telefone}`}
                    style={{ ...s.btn, background: '#22C55E20', color: VERDE, textDecoration: 'none', textAlign: 'center' as const }}>
                    📞 Cliente
                  </a>
                  <button onClick={() => setModalCodigo(p.id)} style={{ ...s.btn, background: VERDE, color: '#fff' }}>
                    ✓ Confirmar entrega
                  </button>
                </>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal recusa */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={s.modalCard} className="anim-fadeUp">
            <h3 style={s.modalTitulo}>Recusar entrega</h3>
            <p style={{ fontSize: 13, color: TEXTO_MEIO }}>3 recusas sem justificativa resultam em bloqueio automático.</p>
            <textarea style={s.textarea} placeholder="Motivo (opcional — evita penalidade)…"
              value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={3} />
            <div style={s.modalAcoes}>
              <button onClick={() => setModal(null)} style={s.btnCancelar}>Voltar</button>
              <button onClick={() => recusar(modal, justificativa || undefined)}
                style={{ ...s.btn, background: '#EF444420', color: VERMELHO }}>
                ✕ Confirmar recusa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal código de confirmação */}
      {modalCodigo && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && (setModalCodigo(null), setCodigo(''))}>
          <div style={s.modalCard} className="anim-fadeUp">
            <h3 style={s.modalTitulo}>Confirmar entrega</h3>
            <p style={{ fontSize: 13, color: TEXTO_MEIO }}>
              Digite o código de confirmação.
            </p>
            <input
              style={{ ...s.textarea, textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: 8, height: 'auto', padding: '16px' }}
              type="text" inputMode="numeric" maxLength={4}
              value={codigo}
              onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
            />
            <div style={s.modalAcoes}>
              <button onClick={() => { setModalCodigo(null); setCodigo('') }} style={s.btnCancelar}>Cancelar</button>
              <button onClick={() => {
                const p = pedidos.find(p => p.id === modalCodigo)
                if (p) confirmarEntrega(modalCodigo, p.codigo_confirmacao)
              }} style={{ ...s.btn, background: VERDE, color: '#fff' }}>
                ✓ Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:       { display: 'flex', flexDirection: 'column', gap: 16 },
  titulo:     { fontSize: 22, fontWeight: 800, color: TEXTO },
  loading:    { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:    { width: 32, height: 32, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  vazio:      { textAlign: 'center' as const, padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  lista:      { display: 'flex', flexDirection: 'column', gap: 12 },
  card:       { background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardNovo:   { boxShadow: `0 0 0 2px ${DOURADO}` },
  novoBadge:  { background: DOURADO, color: '#fff', fontSize: 12, fontWeight: 800, padding: '6px', borderRadius: 8, textAlign: 'center' as const },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 10 },
  id:         { fontWeight: 800, fontSize: 12, color: AZUL, fontFamily: 'monospace', flex: 1 },
  pill:       { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  info:       { display: 'flex', flexDirection: 'column', gap: 6 },
  infoItem:   { display: 'flex', gap: 8 },
  infoL:      { fontSize: 11, color: TEXTO_MEIO, fontWeight: 700, width: 70, flexShrink: 0 },
  infoV:      { fontSize: 13, color: TEXTO, fontWeight: 600 },
  itens:      { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  itemTag:    { fontSize: 11, fontWeight: 700, background: '#F4F6FB', color: TEXTO_MEIO, padding: '4px 10px', borderRadius: 20 },
  acoes:      { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  btn:        { flex: 1, padding: '11px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', minWidth: 80 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard:  { background: '#fff', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitulo:{ fontSize: 17, fontWeight: 800, color: TEXTO },
  textarea:   { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '12px', fontSize: 14, color: TEXTO, resize: 'none' as const, fontFamily: 'inherit', outline: 'none', width: '100%' },
  modalAcoes: { display: 'flex', gap: 10 },
  btnCancelar:{ flex: 1, padding: '12px', borderRadius: 10, border: `1.5px solid ${CINZA_BORDA}`, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: TEXTO_MEIO },
}
