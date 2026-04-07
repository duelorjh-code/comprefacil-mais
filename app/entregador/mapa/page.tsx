'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE } from '@/lib/constants'
import { MAPA_STYLE } from '@/lib/mapa-style'

const LAT_DEFAULT = -20.70
const LNG_DEFAULT = -51.70

export default function EntregadorMapa() {
  const router     = useRouter()
  const mapRef     = useRef<HTMLDivElement>(null)
  const mapObj     = useRef<any>(null)
  const motoMarker = useRef<any>(null)
  const destMarker = useRef<any>(null)
  const retMarker  = useRef<any>(null)

  const [pedido, setPedido]     = useState<any>(null)
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null)
  const [entId, setEntId]       = useState('')
  const [modalNav, setModalNav] = useState(false)
  const watchRef = useRef<number | null>(null)

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
    const { data: e } = await supabase.from('entregadores').select('id').eq('usuario_id', user.id).single()
    if (!e) return
    setEntId(e.id)

    const res   = await fetch(`/api/entregador/pedidos?entregador_id=${e.id}&status=a_caminho`)
    const lista = await res.json()
    if (Array.isArray(lista) && lista.length > 0) setPedido(lista[0])

    if (navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        pos => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          supabase.from('entregadores').update({ lat_atual: c.lat, lng_atual: c.lng }).eq('id', e.id)
        },
        undefined,
        { enableHighAccuracy: true }
      )
    }
  }

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
      style:     MAPA_STYLE as any,
      center:    [LNG_DEFAULT, LAT_DEFAULT],
      zoom:      14,
      attributionControl: false,
    })

    map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new ml.NavigationControl({ showCompass: true }), 'top-right')

    map.on('load', () => {
      mapObj.current = map

      // Marcador de moto
      const el     = document.createElement('div')
      el.innerHTML = `<div style="background:${AZUL};width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:18px">🏍️</div>`
      motoMarker.current = new ml.Marker({ element: el, anchor: 'center' })
        .setLngLat([LNG_DEFAULT, LAT_DEFAULT])
        .addTo(map)
    })

    mapObj.current = map
  }

  // Atualiza posição da moto
  useEffect(() => {
    if (!coords || !mapObj.current || !motoMarker.current) return
    motoMarker.current.setLngLat([coords.lng, coords.lat])
    mapObj.current.easeTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 600 })
  }, [coords])

  // Atualiza marcadores de pedido
  useEffect(() => {
    if (!pedido || !mapObj.current) return
    const ml = (window as any).maplibregl
    if (!ml) return

    if (destMarker.current) { destMarker.current.remove(); destMarker.current = null }
    if (retMarker.current)  { retMarker.current.remove();  retMarker.current  = null }

    // Destino
    const elDest = document.createElement('div')
    elDest.innerHTML = `<div style="background:#22C55E;padding:6px 10px;border-radius:10px;color:#fff;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25)">🏠 Destino</div>`
    destMarker.current = new ml.Marker({ element: elDest, anchor: 'bottom' })
      .setLngLat([pedido.lng_entrega, pedido.lat_entrega])
      .addTo(mapObj.current)

    // Retirada
    if (pedido.parceiros?.lat) {
      const elRet = document.createElement('div')
      elRet.innerHTML = `<div style="background:#D4A017;padding:6px 10px;border-radius:10px;color:#fff;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25)">📦 Retirada</div>`
      retMarker.current = new ml.Marker({ element: elRet, anchor: 'bottom' })
        .setLngLat([pedido.parceiros.lng, pedido.parceiros.lat])
        .addTo(mapObj.current)
    }

    // Linha pontilhada moto → destino
    if (coords && mapObj.current.isStyleLoaded()) {
      if (mapObj.current.getLayer('rota')) {
        mapObj.current.removeLayer('rota')
        mapObj.current.removeSource('rota')
      }
      mapObj.current.addSource('rota', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [coords.lng, coords.lat],
              [pedido.lng_entrega, pedido.lat_entrega],
            ],
          },
        },
      })
      mapObj.current.addLayer({
        id: 'rota', type: 'line', source: 'rota',
        paint: { 'line-color': AZUL, 'line-width': 3, 'line-dasharray': [2, 2] },
      })

      // Ajusta bounds para ver tudo
      const bounds = new ml.LngLatBounds()
      bounds.extend([coords.lng, coords.lat])
      bounds.extend([pedido.lng_entrega, pedido.lat_entrega])
      mapObj.current.fitBounds(bounds, { padding: 80, duration: 800 })
    }
  }, [pedido, coords])

  const lat = pedido?.lat_entrega
  const lng = pedido?.lng_entrega

  const appsNav = lat && lng ? [
    { nome: 'Google Maps', icone: '🗺️', cor: '#4285F4', url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
    { nome: 'Waze',        icone: '🧭', cor: '#05C8F7', url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes&zoom=17` },
    { nome: 'Apple Maps',  icone: '🍎', cor: '#000',    url: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d` },
    { nome: 'Moovit',      icone: '🚌', cor: '#F5A623', url: `https://moovitapp.com/index/pt-br/transporte_público-${encodeURIComponent(pedido?.endereco_entrega ?? '')}-BR` },
  ] : []

  return (
    <div style={s.wrap}>
      {/* Topbar */}
      <div style={s.topbar}>
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <span style={s.titulo}>Mapa GPS</span>
        {appsNav.length > 0 && (
          <button onClick={() => setModalNav(true)} style={s.btnNav}>🧭 Navegar</button>
        )}
      </div>

      {/* Mapa */}
      <div ref={mapRef} style={s.mapa} />

      {/* Info do pedido */}
      {pedido && (
        <div style={s.info}>
          <div style={s.infoRow}>
            <span style={s.infoL}>📦 Retirar em</span>
            <span style={s.infoV}>
              {pedido.parceiros?.nome_fantasia
                ? `${pedido.parceiros.nome_fantasia} — ${pedido.parceiros.endereco ?? ''}, ${pedido.parceiros.numero ?? ''}`.trim().replace(/,\s*$/, '')
                : '—'}
            </span>
          </div>
          <div style={s.infoRow}>
            <span style={s.infoL}>🏠 Entregar em</span>
            <span style={s.infoV}>{pedido.endereco_entrega}</span>
          </div>
          <div style={s.infoRow}>
            <span style={s.infoL}>👤 Cliente</span>
            <span style={s.infoV}>{pedido.clientes?.perfis?.nome ?? '—'}</span>
          </div>
          <a href={`https://wa.me/55${pedido.clientes?.perfis?.telefone?.replace(/\D/g, '')}?text=Olá, sou o entregador do seu pedido CompreFácil+. Estou a caminho!`}
            target="_blank" rel="noreferrer" style={s.btnWhats}>
            💬 WhatsApp cliente
          </a>
        </div>
      )}

      {!pedido && (
        <div style={s.semPedido}>
          <p style={{ fontSize: 13, color: '#64748B', textAlign: 'center' as const }}>
            Nenhum pedido em andamento no momento.
          </p>
        </div>
      )}

      {/* Modal seleção de app de navegação */}
      {modalNav && (
        <div style={s.overlay} onClick={() => setModalNav(false)}>
          <div style={s.modalNav} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitulo}>Abrir navegação com:</div>
            {appsNav.map(app => (
              <a key={app.nome} href={app.url} target="_blank" rel="noreferrer"
                onClick={() => setModalNav(false)}
                style={{ ...s.appBtn, borderColor: app.cor }}>
                <span style={s.appIcone}>{app.icone}</span>
                <span style={{ ...s.appNome, color: app.cor }}>{app.nome}</span>
                <span style={s.appSeta}>→</span>
              </a>
            ))}
            <button onClick={() => setModalNav(false)} style={s.btnFecharModal}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:          { display: 'flex', flexDirection: 'column', height: '100vh', margin: -16, fontFamily: "'Nunito', sans-serif" },
  topbar:        { background: AZUL, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 },
  voltar:        { background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  titulo:        { flex: 1, color: '#fff', fontSize: 15, fontWeight: 800 },
  btnNav:        { background: DOURADO, color: '#fff', padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  mapa:          { flex: 1, zIndex: 0 },
  info:          { background: '#fff', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 -4px 16px rgba(0,0,0,0.1)' },
  infoRow:       { display: 'flex', gap: 8, alignItems: 'flex-start' },
  infoL:         { fontSize: 11, fontWeight: 700, color: '#8A95A5', width: 80, flexShrink: 0 },
  infoV:         { fontSize: 13, color: '#1A2340', fontWeight: 600, flex: 1 },
  semPedido:     { background: '#fff', padding: '20px', boxShadow: '0 -4px 16px rgba(0,0,0,0.1)' },
  btnWhats:      { display: 'block', padding: '12px', background: '#25D36620', color: '#25D366', borderRadius: 10, textAlign: 'center' as const, fontSize: 13, fontWeight: 700, textDecoration: 'none', border: '1px solid #25D36630' },
  overlay:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modalNav:      { background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 },
  modalTitulo:   { fontSize: 16, fontWeight: 800, color: '#1A2340', marginBottom: 4, textAlign: 'center' as const },
  appBtn:        { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: '2px solid', textDecoration: 'none', background: '#fff' },
  appIcone:      { fontSize: 24 },
  appNome:       { flex: 1, fontSize: 15, fontWeight: 800 },
  appSeta:       { fontSize: 16, color: '#94A3B8' },
  btnFecharModal:{ padding: '14px', background: '#F4F6FB', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#64748B', marginTop: 4 },
}
