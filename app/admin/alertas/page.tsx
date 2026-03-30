'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

const CORES_RAIO = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

export default function AdminAlertas() {
  const [parceiros, setParceiros]       = useState<any[]>([])
  const [entregadores, setEntregadores] = useState<any[]>([])
  const mapLojasRef = useRef<HTMLDivElement>(null)
  const mapEntRef   = useRef<HTMLDivElement>(null)
  const mapLojasObj = useRef<any>(null)
  const mapEntObj   = useRef<any>(null)
  const marcLojasRef = useRef<any[]>([])
  const marcEntRef   = useRef<any[]>([])

  useEffect(() => {
    carregarDados()
    carregarLeaflet()
    const canal = supabase.channel('mapa-entregadores')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'entregadores' }, () => {
        carregarEntregadores()
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  useEffect(() => {
    if (mapLojasObj.current) atualizarMarcadoresLojas()
  }, [parceiros])

  useEffect(() => {
    if (mapEntObj.current) atualizarMarcadoresEntregadores()
  }, [entregadores])

  async function carregarDados() {
    await Promise.all([carregarParceiros(), carregarEntregadores()])
  }

  async function carregarParceiros() {
    const { data } = await supabase.from('parceiros')
      .select('id, nome_fantasia, endereco, numero, cidade, lat, lng')
      .not('lat', 'is', null).not('lng', 'is', null)
    setParceiros(data ?? [])
  }

  async function carregarEntregadores() {
    const { data } = await supabase.from('entregadores')
      .select('id, status, lat_atual, lng_atual, tipo_veiculo, perfis:usuario_id ( nome, telefone )')
      .eq('status', 'online')
      .not('lat_atual', 'is', null).not('lng_atual', 'is', null)
    setEntregadores(data ?? [])
  }

  async function carregarLeaflet() {
    if ((window as any).L) { initMapas((window as any).L); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => initMapas((window as any).L)
    document.head.appendChild(script)
  }

  function initMapas(L: any) {
    if (mapLojasRef.current && !mapLojasObj.current) {
      const m = L.map(mapLojasRef.current).setView([-20.768, -51.719], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(m)
      mapLojasObj.current = m
      setTimeout(() => { m.invalidateSize(); atualizarMarcadoresLojas() }, 300)
    }
    if (mapEntRef.current && !mapEntObj.current) {
      const m = L.map(mapEntRef.current).setView([-20.768, -51.719], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(m)
      mapEntObj.current = m
      setTimeout(() => { m.invalidateSize(); atualizarMarcadoresEntregadores() }, 300)
    }
  }

  function atualizarMarcadoresLojas() {
    const L = (window as any).L
    if (!L || !mapLojasObj.current) return
    marcLojasRef.current.forEach(m => m.remove())
    marcLojasRef.current = []

    parceiros.forEach((p, i) => {
      if (!p.lat || !p.lng) return
      const cor = CORES_RAIO[i % CORES_RAIO.length]

      // Raio 6km
      const raio = L.circle([p.lat, p.lng], {
        radius: 6000,
        color: cor,
        fillColor: cor,
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '6 4',
      }).addTo(mapLojasObj.current)

      // Marcador
      const icone = L.divIcon({
        html: `<div style="background:${cor};color:#fff;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25)">📍 ${p.nome_fantasia}</div>`,
        className: '', iconAnchor: [0, 0],
      })
      const m = L.marker([p.lat, p.lng], { icon: icone })
        .addTo(mapLojasObj.current)
        .bindPopup(`<b>${p.nome_fantasia}</b><br>${p.endereco}, ${p.numero}<br>${p.cidade}<br>Raio: 6km`)

      marcLojasRef.current.push(raio, m)
    })

    if (parceiros.length > 0 && parceiros[0].lat) {
      mapLojasObj.current.setView([parceiros[0].lat, parceiros[0].lng], 13)
    }
  }

  function atualizarMarcadoresEntregadores() {
    const L = (window as any).L
    if (!L || !mapEntObj.current) return
    marcEntRef.current.forEach(m => m.remove())
    marcEntRef.current = []

    entregadores.forEach((e, i) => {
      if (!e.lat_atual || !e.lng_atual) return
      const cor = CORES_RAIO[i % CORES_RAIO.length]

      // Raio 6km
      const raio = L.circle([e.lat_atual, e.lng_atual], {
        radius: 6000,
        color: cor,
        fillColor: cor,
        fillOpacity: 0.06,
        weight: 2,
        dashArray: '6 4',
      }).addTo(mapEntObj.current)

      const icone = L.divIcon({
        html: `<div style="background:${AZUL};color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid ${cor};box-shadow:0 2px 8px rgba(0,0,0,0.3)">${e.tipo_veiculo === 'moto' ? '🏍️' : '⚡'}</div>`,
        className: '', iconSize: [34, 34], iconAnchor: [17, 17],
      })
      const m = L.marker([e.lat_atual, e.lng_atual], { icon: icone })
        .addTo(mapEntObj.current)
        .bindPopup(`<b>${e.perfis?.nome ?? '—'}</b><br>${e.perfis?.telefone ?? ''}<br>🟢 Online`)

      marcEntRef.current.push(raio, m)
    })

    if (entregadores.length > 0) {
      mapEntObj.current.setView([entregadores[0].lat_atual, entregadores[0].lng_atual], 13)
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
  wrap:             { display: 'flex', flexDirection: 'column', gap: 24 },
  titulo:           { fontSize: 22, fontWeight: 800, color: TEXTO, margin: 0 },
  secao:            { display: 'flex', flexDirection: 'column', gap: 8 },
  secaoHeader:      { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const },
  secaoTitulo:      { fontSize: 15, fontWeight: 800, color: TEXTO },
  legendaRaios:     { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  legendaRaioItem:  { fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, border: '1.5px solid', background: '#fff' },
  legendaInfo:      { fontSize: 12, color: TEXTO_MEIO },
  mapa:             { width: '100%', height: 280, borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${CINZA_BORDA}` },
  vazio:            { textAlign: 'center' as const, padding: 16, color: TEXTO_MEIO, fontSize: 14 },
}
