'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

export default function AdminMapas() {
  const [aba, setAba]             = useState<'lojas' | 'entregadores'>('lojas')
  const [parceiros, setParceiros] = useState<any[]>([])
  const [entregadores, setEntregadores] = useState<any[]>([])
  const mapLojasRef   = useRef<HTMLDivElement>(null)
  const mapEntRef     = useRef<HTMLDivElement>(null)
  const mapLojasObj   = useRef<any>(null)
  const mapEntObj     = useRef<any>(null)
  const marcadores    = useRef<any[]>([])

  useEffect(() => {
    carregarDados()
    carregarLeaflet()

    // Realtime entregadores
    const canal = supabase.channel('mapa-entregadores')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'entregadores' }, () => {
        carregarEntregadores()
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  useEffect(() => {
    if (aba === 'lojas' && mapLojasObj.current) atualizarMarcadoresLojas()
    if (aba === 'entregadores' && mapEntObj.current) atualizarMarcadoresEntregadores()
  }, [aba, parceiros, entregadores])

  async function carregarDados() {
    await Promise.all([carregarParceiros(), carregarEntregadores()])
  }

  async function carregarParceiros() {
    const { data } = await supabase.from('parceiros')
      .select('id, nome_fantasia, endereco, numero, cidade, lat, lng, ativo, online')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
    setParceiros(data ?? [])
  }

  async function carregarEntregadores() {
    const { data } = await supabase.from('entregadores')
      .select('id, status, lat_atual, lng_atual, tipo_veiculo, perfis ( nome, telefone )')
      .eq('status', 'online')
      .not('lat_atual', 'is', null)
      .not('lng_atual', 'is', null)
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
    // Mapa lojas
    if (mapLojasRef.current && !mapLojasObj.current) {
      const m = L.map(mapLojasRef.current).setView([-20.768, -51.719], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(m)
      mapLojasObj.current = m
      setTimeout(() => { m.invalidateSize(); atualizarMarcadoresLojas() }, 300)
    }
    // Mapa entregadores
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
    marcadores.current.forEach(m => m.remove())
    marcadores.current = []
    parceiros.forEach(p => {
      if (!p.lat || !p.lng) return
      const icone = L.divIcon({
        html: `<div style="background:${p.online ? VERDE : '#6B7280'};color:#fff;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">${p.online ? '🏪' : '🔒'} ${p.nome_fantasia}</div>`,
        className: '', iconAnchor: [0, 0],
      })
      const m = L.marker([p.lat, p.lng], { icon: icone })
        .addTo(mapLojasObj.current)
        .bindPopup(`<b>${p.nome_fantasia}</b><br>${p.endereco}, ${p.numero}<br>${p.cidade}<br>${p.online ? '🟢 Online' : '🔴 Offline'}`)
      marcadores.current.push(m)
    })
    if (parceiros.length > 0 && parceiros[0].lat) {
      mapLojasObj.current.setView([parceiros[0].lat, parceiros[0].lng], 13)
    }
  }

  function atualizarMarcadoresEntregadores() {
    const L = (window as any).L
    if (!L || !mapEntObj.current) return
    marcadores.current.forEach(m => m.remove())
    marcadores.current = []
    entregadores.forEach(e => {
      if (!e.lat_atual || !e.lng_atual) return
      const icone = L.divIcon({
        html: `<div style="background:${AZUL};color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid ${DOURADO};box-shadow:0 2px 8px rgba(0,0,0,0.3)">${e.tipo_veiculo === 'moto' ? '🏍️' : '⚡'}</div>`,
        className: '', iconSize: [36, 36], iconAnchor: [18, 18],
      })
      const m = L.marker([e.lat_atual, e.lng_atual], { icon: icone })
        .addTo(mapEntObj.current)
        .bindPopup(`<b>${e.perfis?.nome ?? '—'}</b><br>${e.perfis?.telefone ?? ''}<br>🟢 Online`)
      marcadores.current.push(m)
    })
    if (entregadores.length > 0) {
      mapEntObj.current.setView([entregadores[0].lat_atual, entregadores[0].lng_atual], 14)
    }
  }

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <h1 style={s.titulo}>Mapas</h1>

      <div style={s.tabs}>
        <button onClick={() => setAba('lojas')} style={{ ...s.tab, ...(aba === 'lojas' ? s.tabAtivo : {}) }}>
          🏪 Lojas cadastradas ({parceiros.length})
        </button>
        <button onClick={() => setAba('entregadores')} style={{ ...s.tab, ...(aba === 'entregadores' ? s.tabAtivo : {}) }}>
          🛵 Entregadores online ({entregadores.length})
        </button>
      </div>

      {/* Mapa lojas */}
      <div style={{ display: aba === 'lojas' ? 'block' : 'none' }}>
        <div style={s.legenda}>
          <span style={{ ...s.legendaItem, color: VERDE }}>🏪 Online</span>
          <span style={{ ...s.legendaItem, color: '#6B7280' }}>🔒 Offline</span>
          <span style={s.legendaInfo}>{parceiros.filter(p => !p.lat).length} sem coordenadas</span>
        </div>
        <div ref={mapLojasRef} style={s.mapa} />
        <div style={s.lista}>
          {parceiros.map(p => (
            <div key={p.id} style={s.listaItem}>
              <span style={{ ...s.dot, background: p.online ? VERDE : '#6B7280' }} />
              <span style={s.listaNome}>{p.nome_fantasia}</span>
              <span style={s.listaSub}>{p.cidade}</span>
              {!p.lat && <span style={{ fontSize: 10, color: VERMELHO }}>sem GPS</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Mapa entregadores */}
      <div style={{ display: aba === 'entregadores' ? 'block' : 'none' }}>
        <div style={s.legenda}>
          <span style={s.legendaInfo}>Atualiza em tempo real via Supabase Realtime</span>
        </div>
        <div ref={mapEntRef} style={s.mapa} />
        {entregadores.length === 0 && (
          <div style={s.vazio}>🛵 Nenhum entregador online com GPS ativo no momento.</div>
        )}
        <div style={s.lista}>
          {entregadores.map(e => (
            <div key={e.id} style={s.listaItem}>
              <span style={{ ...s.dot, background: VERDE }} />
              <span style={s.listaNome}>{e.perfis?.nome ?? '—'}</span>
              <span style={s.listaSub}>{e.perfis?.telefone}</span>
              <span style={{ fontSize: 11, color: AZUL }}>{e.tipo_veiculo === 'moto' ? '🏍️ Moto' : '⚡ E-Bike'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 20 },
  titulo:      { fontSize: 22, fontWeight: 800, color: TEXTO, margin: 0 },
  tabs:        { display: 'flex', gap: 8 },
  tab:         { padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${CINZA_BORDA}`, background: '#fff', fontSize: 13, fontWeight: 700, color: TEXTO_MEIO, cursor: 'pointer', fontFamily: 'inherit' },
  tabAtivo:    { background: AZUL, color: '#fff', borderColor: AZUL },
  legenda:     { display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 },
  legendaItem: { fontSize: 13, fontWeight: 700 },
  legendaInfo: { fontSize: 12, color: TEXTO_MEIO },
  mapa:        { width: '100%', height: 420, borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${CINZA_BORDA}` },
  lista:       { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
  listaItem:   { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(27,47,94,0.05)' },
  dot:         { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  listaNome:   { fontSize: 13, fontWeight: 700, color: TEXTO, flex: 1 },
  listaSub:    { fontSize: 12, color: TEXTO_MEIO },
  vazio:       { textAlign: 'center' as const, padding: 20, color: TEXTO_MEIO, fontSize: 14 },
}
