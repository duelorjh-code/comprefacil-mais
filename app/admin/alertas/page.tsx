'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'
import { MAPA_STYLE } from '@/lib/mapa-style'

const LAT_DEFAULT = -20.70
const LNG_DEFAULT = -51.70

const CORES_RAIO = [
  '#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6',
  '#EC4899','#06B6D4','#84CC16','#F97316','#6366F1',
]

export default function AdminAlertas() {
  const [parceiros, setParceiros]       = useState<any[]>([])
  const [entregadores, setEntregadores] = useState<any[]>([])

  const mapLojasRef  = useRef<HTMLDivElement>(null)
  const mapEntRef    = useRef<HTMLDivElement>(null)
  const mapLojasObj  = useRef<any>(null)
  const mapEntObj    = useRef<any>(null)
  const marcLojasRef = useRef<any[]>([])
  const marcEntRef   = useRef<any[]>([])

  useEffect(() => {
    carregarDados()
    carregarMapLibre()

    const canal = supabase.channel('mapa-entregadores')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'entregadores' }, () => {
        carregarEntregadores()
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  useEffect(() => { if (mapLojasObj.current) atualizarMarcadoresLojas() }, [parceiros])
  useEffect(() => { if (mapEntObj.current)   atualizarMarcadoresEntregadores() }, [entregadores])

  async function carregarDados() {
    await Promise.all([carregarParceiros(), carregarEntregadores()])
  }

  async function carregarParceiros() {
    const { data } = await supabase
      .from('parceiros')
      .select('id, nome_fantasia, endereco, numero, cidade, lat, lng')
      .not('lat', 'is', null).not('lng', 'is', null)
    setParceiros(data ?? [])
  }

  async function carregarEntregadores() {
    const { data } = await supabase
      .from('entregadores')
      .select('id, status, lat_atual, lng_atual, tipo_veiculo, perfis:usuario_id ( nome, telefone )')
      .eq('status', 'online')
      .not('lat_atual', 'is', null).not('lng_atual', 'is', null)
    setEntregadores(data ?? [])
  }

  function carregarMapLibre() {
    if ((window as any).maplibregl) { initMapas((window as any).maplibregl); return }

    const css = document.createElement('link')
    css.rel   = 'stylesheet'
    css.href  = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/3.6.2/maplibre-gl.min.css'
    document.head.appendChild(css)

    const script = document.createElement('script')
    script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/3.6.2/maplibre-gl.min.js'
    script.onload = () => initMapas((window as any).maplibregl)
    document.head.appendChild(script)
  }

  function criarMapa(ml: any, container: HTMLDivElement) {
    const map = new ml.Map({
      container,
      style: MAPA_STYLE as any,
      center: [LNG_DEFAULT, LAT_DEFAULT],
      zoom: 12,
      attributionControl: false,
    })
    map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
    return map
  }

  function initMapas(ml: any) {
    if (mapLojasRef.current && !mapLojasObj.current) {
      const m = criarMapa(ml, mapLojasRef.current)
      m.on('load', () => {
        mapLojasObj.current = m
        atualizarMarcadoresLojas()
      })
    }
    if (mapEntRef.current && !mapEntObj.current) {
      const m = criarMapa(ml, mapEntRef.current)
      m.on('load', () => {
        mapEntObj.current = m
        atualizarMarcadoresEntregadores()
      })
    }
  }

  function atualizarMarcadoresLojas() {
    const ml = (window as any).maplibregl
    if (!ml || !mapLojasObj.current) return

    marcLojasRef.current.forEach(m => m.remove())
    marcLojasRef.current = []

    const bounds = (ml as any).LngLatBounds ? new ml.LngLatBounds() : null

    parceiros.forEach((p, i) => {
      if (!p.lat || !p.lng) return
      const cor = CORES_RAIO[i % CORES_RAIO.length]

      // Círculo de 6km via GeoJSON
      const sourceId = `raio-${p.id}`
      if (!mapLojasObj.current.getSource(sourceId)) {
        // Gera pontos do círculo
        const pontos: number[][] = []
        for (let a = 0; a <= 360; a += 6) {
          const rad = a * Math.PI / 180
          const dLat = (6000 / 111320) * Math.cos(rad)
          const dLng = (6000 / (111320 * Math.cos(p.lat * Math.PI / 180))) * Math.sin(rad)
          pontos.push([p.lng + dLng, p.lat + dLat])
        }
        mapLojasObj.current.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pontos] } },
        })
        mapLojasObj.current.addLayer({
          id: sourceId, type: 'fill', source: sourceId,
          paint: { 'fill-color': cor, 'fill-opacity': 0.08 },
        })
        mapLojasObj.current.addLayer({
          id: sourceId + '-border', type: 'line', source: sourceId,
          paint: { 'line-color': cor, 'line-width': 2, 'line-dasharray': [3, 3] },
        })
      }

      // Marcador da loja
      const el     = document.createElement('div')
      el.innerHTML = `<div style="background:${cor};color:#fff;border-radius:10px;padding:5px 10px;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2)">📍 ${p.nome_fantasia}</div>`
      const marker = new ml.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([p.lng, p.lat])
        .setPopup(new ml.Popup({ offset: 25 }).setHTML(`<b>${p.nome_fantasia}</b><br>${p.endereco}, ${p.numero}<br>${p.cidade}<br>Raio: 6km`))
        .addTo(mapLojasObj.current)

      marcLojasRef.current.push(marker)
      if (bounds) bounds.extend([p.lng, p.lat])
    })

    if (bounds && !bounds.isEmpty()) {
      mapLojasObj.current.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 14 })
    }
  }

  function atualizarMarcadoresEntregadores() {
    const ml = (window as any).maplibregl
    if (!ml || !mapEntObj.current) return

    marcEntRef.current.forEach(m => m.remove())
    marcEntRef.current = []

    const bounds = new ml.LngLatBounds()

    entregadores.forEach((e, i) => {
      if (!e.lat_atual || !e.lng_atual) return
      const cor = CORES_RAIO[i % CORES_RAIO.length]

      const el     = document.createElement('div')
      el.innerHTML = `<div style="background:${AZUL};color:#fff;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid ${cor};box-shadow:0 2px 8px rgba(0,0,0,0.3)">${e.tipo_veiculo === 'moto' ? '🏍️' : '⚡'}</div>`

      const marker = new ml.Marker({ element: el, anchor: 'center' })
        .setLngLat([e.lng_atual, e.lat_atual])
        .setPopup(new ml.Popup({ offset: 20 }).setHTML(`<b>${e.perfis?.nome ?? '—'}</b><br>${e.perfis?.telefone ?? ''}<br>🟢 Online`))
        .addTo(mapEntObj.current)

      marcEntRef.current.push(marker)
      bounds.extend([e.lng_atual, e.lat_atual])
    })

    if (!bounds.isEmpty()) {
      mapEntObj.current.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 15 })
    } else {
      mapEntObj.current.flyTo({ center: [LNG_DEFAULT, LAT_DEFAULT], zoom: 12 })
    }
  }

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <h1 style={s.titulo}>Mapa Estratégico</h1>

      {/* Mapa Lojas */}
      <div style={s.secao}>
        <div style={s.secaoHeader}>
          <span style={s.secaoTitulo}>🏪 Lojas cadastradas ({parceiros.length})</span>
          <div style={s.legendaRaios}>
            {parceiros.map((p, i) => (
              <span key={p.id} style={{ ...s.legendaRaioItem, borderColor: CORES_RAIO[i % CORES_RAIO.length], color: CORES_RAIO[i % CORES_RAIO.length] }}>
                {p.nome_fantasia}
              </span>
            ))}
          </div>
        </div>
        <div ref={mapLojasRef} style={s.mapa} />
      </div>

      {/* Mapa Entregadores */}
      <div style={s.secao}>
        <div style={s.secaoHeader}>
          <span style={s.secaoTitulo}>🛵 Entregadores online ({entregadores.length})</span>
          <span style={s.legendaInfo}>Atualiza em tempo real</span>
        </div>
        <div ref={mapEntRef} style={s.mapa} />
        {entregadores.length === 0 && (
          <div style={s.vazio}>🛵 Nenhum entregador online com GPS ativo no momento.</div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:            { display: 'flex', flexDirection: 'column', gap: 24 },
  titulo:          { fontSize: 22, fontWeight: 800, color: '#1A2340', margin: 0 },
  secao:           { display: 'flex', flexDirection: 'column', gap: 8 },
  secaoHeader:     { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const },
  secaoTitulo:     { fontSize: 15, fontWeight: 800, color: '#1A2340' },
  legendaRaios:    { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  legendaRaioItem: { fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, border: '1.5px solid', background: '#fff' },
  legendaInfo:     { fontSize: 12, color: TEXTO_MEIO },
  mapa:            { width: '100%', height: 320, borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${CINZA_BORDA}` },
  vazio:           { textAlign: 'center' as const, padding: 16, color: TEXTO_MEIO, fontSize: 14 },
}
