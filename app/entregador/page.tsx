'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

const LAT_DEFAULT = -20.70
const LNG_DEFAULT = -51.70

// Ícone SVG de moto para o marcador — rotaciona conforme direção
const MOTO_SVG = (cor: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="18" fill="${cor}" opacity="0.15"/>
  <circle cx="20" cy="20" r="12" fill="${cor}"/>
  <text x="20" y="25" text-anchor="middle" font-size="14">🏍️</text>
</svg>`

export default function EntregadorPage() {
  const router = useRouter()

  // Estado do entregador
  const [entId, setEntId]       = useState('')
  const [online, setOnline]     = useState(false)
  const [validado, setValidado] = useState(false)
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null)
  const [heading, setHeading]   = useState(0)

  // Estado de pedidos
  const [pedidos, setPedidos]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState<string | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [codigo, setCodigo]           = useState('')
  const [modalCodigo, setModalCodigo] = useState<string | null>(null)

  // Mapa
  const mapRef     = useRef<HTMLDivElement>(null)
  const mapObj     = useRef<any>(null)
  const motoMarker = useRef<any>(null)
  const destMarker = useRef<any>(null)
  const retMarker  = useRef<any>(null)
  const routeLine  = useRef<any>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const watchRef = useRef<number | null>(null)

  const tocarAlarme = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio('/sons/alerta.mp3')
    audioRef.current.play().catch(() => {})
  }, [])

  // ── Inicialização ──────────────────────────────────────────────
  useEffect(() => {
    carregarMapLibre()
    initEntregador()
    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null }
    }
  }, [])

  async function initEntregador() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: e } = await supabase
      .from('entregadores')
      .select('id, status, validado')
      .eq('usuario_id', user.id)
      .single()

    if (!e) return
    setEntId(e.id)
    setOnline(e.status === 'online')
    setValidado(e.validado)
    await carregar(e.id)

    // GPS contínuo
    if (navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        pos => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          if (pos.coords.heading !== null) setHeading(pos.coords.heading ?? 0)
          supabase.from('entregadores')
            .update({ lat_atual: c.lat, lng_atual: c.lng })
            .eq('id', e.id)
        },
        undefined,
        { enableHighAccuracy: true, maximumAge: 5000 }
      )
    }

    // Realtime — novos pedidos
    supabase.channel('ent-live-' + e.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        carregar(e.id)
        tocarAlarme()
      })
      .subscribe()
  }

  async function carregar(eid: string) {
    const res  = await fetch(`/api/entregador/pedidos?entregador_id=${eid}`)
    const data = await res.json()
    setPedidos(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  // ── MapLibre GL ────────────────────────────────────────────────
  function carregarMapLibre() {
    if ((window as any).maplibregl) { initMapa((window as any).maplibregl); return }

    const css = document.createElement('link')
    css.rel   = 'stylesheet'
    css.href  = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/3.6.2/maplibre-gl.min.css'
    document.head.appendChild(css)

    const script = document.createElement('script')
    script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/3.6.2/maplibre-gl.min.js'
    script.onload = () => initMapa((window as any).maplibregl)
    document.head.appendChild(script)
  }

  function initMapa(ml: any) {
    if (!mapRef.current || mapObj.current) return

    const map = new ml.Map({
      container: mapRef.current,
      // Estilo Positron — limpo, moderno, perfeito para delivery
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [LNG_DEFAULT, LAT_DEFAULT],
      zoom: 14,
      attributionControl: false,
    })

    map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      mapObj.current = map

      // Elemento HTML do marcador de moto
      const el       = document.createElement('div')
      el.innerHTML   = MOTO_SVG(AZUL)
      el.style.cssText = 'width:40px;height:40px;cursor:pointer;transform-origin:center;transition:transform 0.3s'

      motoMarker.current = new ml.Marker({ element: el, anchor: 'center' })
        .setLngLat([LNG_DEFAULT, LAT_DEFAULT])
        .addTo(map)
    })

    mapObj.current = map
  }

  // ── Atualiza posição da moto no mapa ──────────────────────────
  useEffect(() => {
    if (!coords || !mapObj.current || !motoMarker.current) return
    const { lat, lng } = coords
    motoMarker.current.setLngLat([lng, lat])
    motoMarker.current.getElement().style.transform = `rotate(${heading}deg)`

    // Mapa segue a moto suavemente apenas se online
    if (online) {
      mapObj.current.easeTo({ center: [lng, lat], duration: 800 })
    }
  }, [coords, heading, online])

  // ── Atualiza marcadores de pedido ativo no mapa ───────────────
  useEffect(() => {
    if (!mapObj.current) return
    const ml = (window as any).maplibregl
    if (!ml) return

    // Remove marcadores antigos
    if (destMarker.current) { destMarker.current.remove(); destMarker.current = null }
    if (retMarker.current)  { retMarker.current.remove();  retMarker.current  = null }
    if (routeLine.current && mapObj.current.getLayer('rota')) {
      mapObj.current.removeLayer('rota')
      mapObj.current.removeSource('rota')
      routeLine.current = null
    }

    const pedidoAtivo = pedidos.find(p => p.status === 'a_caminho')
    if (!pedidoAtivo) return

    // Marcador de destino
    const elDest = document.createElement('div')
    elDest.innerHTML = `<div style="background:#22C55E;padding:6px 10px;border-radius:10px;color:#fff;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25)">🏠 Destino</div>`
    destMarker.current = new ml.Marker({ element: elDest, anchor: 'bottom' })
      .setLngLat([pedidoAtivo.lng_entrega, pedidoAtivo.lat_entrega])
      .addTo(mapObj.current)

    // Marcador de retirada
    if (pedidoAtivo.parceiros?.lat) {
      const elRet = document.createElement('div')
      elRet.innerHTML = `<div style="background:#D4A017;padding:6px 10px;border-radius:10px;color:#fff;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25)">📦 Retirada</div>`
      retMarker.current = new ml.Marker({ element: elRet, anchor: 'bottom' })
        .setLngLat([pedidoAtivo.parceiros.lng, pedidoAtivo.parceiros.lat])
        .addTo(mapObj.current)
    }

    // Linha simples entre moto → destino
    if (coords) {
      const geojson = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [coords.lng, coords.lat],
            [pedidoAtivo.lng_entrega, pedidoAtivo.lat_entrega],
          ],
        },
      }
      if (mapObj.current.isStyleLoaded()) {
        mapObj.current.addSource('rota', { type: 'geojson', data: geojson })
        mapObj.current.addLayer({
          id: 'rota', type: 'line', source: 'rota',
          paint: { 'line-color': AZUL, 'line-width': 3, 'line-dasharray': [2, 2] },
        })
        routeLine.current = true
      }
    }

    // Centraliza o mapa para ver moto + destino
    if (coords) {
      const bounds = new ml.LngLatBounds()
      bounds.extend([coords.lng, coords.lat])
      bounds.extend([pedidoAtivo.lng_entrega, pedidoAtivo.lat_entrega])
      mapObj.current.fitBounds(bounds, { padding: 60, duration: 800 })
    }
  }, [pedidos, coords])

  // ── Mapa em tom cinza quando offline ─────────────────────────
  useEffect(() => {
    if (!mapObj.current) return
    const canvas = mapRef.current?.querySelector('canvas') as HTMLCanvasElement | null
    if (canvas) canvas.style.filter = online ? 'none' : 'grayscale(80%) brightness(0.9)'
  }, [online])

  // ── Ações do entregador ───────────────────────────────────────
  async function chamarAPI(body: object) {
    const res = await fetch('/api/entregador/acao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async function aceitar(pedidoId: string) {
    const base = { acao: 'aceitar', pedido_id: pedidoId, entregador_id: entId }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const data = await chamarAPI({ ...base, lat: pos.coords.latitude, lng: pos.coords.longitude })
          if (data.erro) return alert(data.erro)
          carregar(entId)
        },
        async () => {
          const data = await chamarAPI(base)
          if (data.erro) return alert(data.erro)
          carregar(entId)
        }
      )
    } else {
      const data = await chamarAPI(base)
      if (data.erro) return alert(data.erro)
      carregar(entId)
    }
  }

  async function recusar(pedidoId: string, just?: string) {
    await chamarAPI({ acao: 'recusar', pedido_id: pedidoId, entregador_id: entId, justificativa: just ?? '' })
    setModal(null); setJustificativa(''); carregar(entId)
  }

  async function confirmarEntrega(pedidoId: string) {
    const data = await chamarAPI({ acao: 'confirmar', pedido_id: pedidoId, entregador_id: entId, codigo })
    if (data.erro) return alert(data.erro)
    setModalCodigo(null); setCodigo(''); carregar(entId)
  }

  const pedidoAtivo = pedidos.find(p => p.status === 'a_caminho')

  return (
    <div style={s.wrap}>
      <audio ref={audioRef} />

      {/* ── Mapa principal ─────────────────────────────────────── */}
      <div style={s.mapaWrap}>
        <div ref={mapRef} style={s.mapa} />

        {/* Overlay quando offline */}
        {!online && (
          <div style={s.mapaOverlay}>
            <div style={s.mapaOfflineCard}>
              <span style={{ fontSize: 32 }}>⚫</span>
              <span style={s.mapaOfflineText}>Fique online para receber pedidos</span>
            </div>
          </div>
        )}

        {/* Badge de pedido ativo sobre o mapa */}
        {pedidoAtivo && (
          <div style={s.mapaBadgeAtivo}>
            🛵 A caminho — {pedidoAtivo.endereco_entrega?.slice(0, 40)}...
          </div>
        )}

        {/* Botão centralizar */}
        {coords && (
          <button style={s.btnCentralizar}
            onClick={() => mapObj.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 600 })}>
            📍
          </button>
        )}
      </div>

      {/* ── Lista de pedidos ───────────────────────────────────── */}
      <div style={s.lista} className="anim-fadeIn">
        <div style={s.listaHeader}>
          <span style={s.listaTitulo}>
            {loading ? 'Carregando...' : pedidos.length === 0 ? 'Aguardando pedidos' : `${pedidos.length} pedido${pedidos.length > 1 ? 's' : ''}`}
          </span>
          {!validado && (
            <span style={s.badgePendente}>⏳ Aguardando validação</span>
          )}
        </div>

        {!loading && pedidos.length === 0 && (
          <div style={s.vazio}>
            <p style={s.vazioTexto}>Seu raio de atuação aparece no mapa acima.</p>
            <p style={s.vazioTexto}>Quando um pedido ficar pronto você será notificado.</p>
          </div>
        )}

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
                color:      p.status === 'a_caminho' ? DOURADO       : VERDE,
              }}>
                {p.status === 'pronto' ? 'Aguardando' : 'A caminho'}
              </span>
            </div>

            <div style={s.info}>
              <div style={s.infoItem}><span style={s.infoL}>Destino</span><span style={s.infoV}>{p.endereco_entrega}</span></div>
              <div style={s.infoItem}>
                <span style={s.infoL}>Retirar em</span>
                <span style={s.infoV}>
                  {p.parceiros?.nome_fantasia
                    ? `${p.parceiros.nome_fantasia} — ${p.parceiros.endereco ?? ''}, ${p.parceiros.numero ?? ''}`.trim().replace(/,\s*$/, '')
                    : '—'}
                </span>
              </div>
              <div style={s.infoItem}><span style={s.infoL}>Cliente</span><span style={s.infoV}>{p.clientes?.perfis?.nome ?? '—'}</span></div>
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

      {/* Modal recusa */}
      {modal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={s.modalCard}>
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
          <div style={s.modalCard}>
            <h3 style={s.modalTitulo}>Confirmar entrega</h3>
            <p style={{ fontSize: 13, color: TEXTO_MEIO }}>Digite o código informado pelo cliente.</p>
            <input
              style={{ ...s.textarea, textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: 8, height: 'auto', padding: '16px' }}
              type="text" inputMode="numeric" maxLength={4}
              value={codigo}
              onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
            />
            <div style={s.modalAcoes}>
              <button onClick={() => { setModalCodigo(null); setCodigo('') }} style={s.btnCancelar}>Cancelar</button>
              <button onClick={() => confirmarEntrega(modalCodigo!)}
                style={{ ...s.btn, background: VERDE, color: '#fff' }}>
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
  wrap:            { display: 'flex', flexDirection: 'column', gap: 0, fontFamily: "'Nunito', sans-serif" },
  // Mapa
  mapaWrap:        { position: 'relative', height: 280, flexShrink: 0 },
  mapa:            { width: '100%', height: '100%' },
  mapaOverlay:     { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  mapaOfflineCard: { background: 'rgba(0,0,0,0.55)', borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 },
  mapaOfflineText: { color: '#fff', fontSize: 13, fontWeight: 700 },
  mapaBadgeAtivo:  { position: 'absolute', bottom: 10, left: 10, right: 10, background: AZUL, color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, textAlign: 'center' as const, pointerEvents: 'none' },
  btnCentralizar:  { position: 'absolute', top: 10, left: 10, background: '#fff', border: 'none', borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  // Lista
  lista:           { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#F4F6FB', minHeight: 200 },
  listaHeader:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  listaTitulo:     { fontSize: 15, fontWeight: 800, color: TEXTO },
  badgePendente:   { fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '3px 10px', borderRadius: 20 },
  vazio:           { background: '#fff', borderRadius: 14, padding: '28px 20px', textAlign: 'center' as const, display: 'flex', flexDirection: 'column', gap: 6 },
  vazioTexto:      { fontSize: 13, color: TEXTO_MEIO, margin: 0 },
  // Cards
  card:            { background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 1px 8px rgba(27,47,94,0.06)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardNovo:        { boxShadow: `0 0 0 2px ${DOURADO}` },
  novoBadge:       { background: DOURADO, color: '#fff', fontSize: 12, fontWeight: 800, padding: '6px', borderRadius: 8, textAlign: 'center' as const },
  cardTop:         { display: 'flex', alignItems: 'center', gap: 10 },
  id:              { fontWeight: 800, fontSize: 12, color: AZUL, fontFamily: 'monospace', flex: 1 },
  pill:            { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  info:            { display: 'flex', flexDirection: 'column', gap: 6 },
  infoItem:        { display: 'flex', gap: 8 },
  infoL:           { fontSize: 11, color: TEXTO_MEIO, fontWeight: 700, width: 70, flexShrink: 0 },
  infoV:           { fontSize: 13, color: TEXTO, fontWeight: 600 },
  itens:           { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  itemTag:         { fontSize: 11, fontWeight: 700, background: '#F4F6FB', color: TEXTO_MEIO, padding: '4px 10px', borderRadius: 20 },
  acoes:           { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  btn:             { flex: 1, padding: '11px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', minWidth: 80 },
  // Modais
  overlay:         { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard:       { background: '#fff', borderRadius: 20, padding: '24px', width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitulo:     { fontSize: 17, fontWeight: 800, color: TEXTO },
  textarea:        { border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '12px', fontSize: 14, color: TEXTO, resize: 'none' as const, fontFamily: 'inherit', outline: 'none', width: '100%' },
  modalAcoes:      { display: 'flex', gap: 10 },
  btnCancelar:     { flex: 1, padding: '12px', borderRadius: 10, border: `1.5px solid ${CINZA_BORDA}`, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: TEXTO_MEIO },
}
