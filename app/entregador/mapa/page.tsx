'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE } from '@/lib/constants'

export default function EntregadorMapa() {
  const router   = useRouter()
  const mapRef   = useRef<HTMLDivElement>(null)
  const mapObj   = useRef<any>(null)
  const marcador = useRef<any>(null)
  const [pedido, setPedido]   = useState<any>(null)
  const [coords, setCoords]   = useState<{ lat: number; lng: number } | null>(null)
  const [entId, setEntId]     = useState('')

  useEffect(() => {
    carregarLeaflet()
    initEntregador()
    return () => { if (mapObj.current) mapObj.current.remove() }
  }, [])

  async function initEntregador() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: e } = await supabase.from('entregadores').select('id').eq('usuario_id', user.id).single()
    if (!e) return
    setEntId(e.id)

    // Busca pedido ativo via API com service role
    const res = await fetch(`/api/entregador/pedidos?entregador_id=${e.id}&status=a_caminho`)
    const lista = await res.json()
    if (Array.isArray(lista) && lista.length > 0) setPedido(lista[0])

    // GPS contínuo
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(c)
        supabase.from('entregadores').update({ lat_atual: c.lat, lng_atual: c.lng }).eq('id', e.id)
      }, undefined, { enableHighAccuracy: true })
    }
  }

  function carregarLeaflet() {
    if ((window as any).L) { initMapa((window as any).L); return }
    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => initMapa((window as any).L)
    document.head.appendChild(script)
  }

  function initMapa(L: any) {
    if (!mapRef.current || mapObj.current) return
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-20.75, -51.7], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map)
    mapObj.current = map

    const icone = L.divIcon({
      html: '<div style="background:#1B2F5E;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
      iconSize: [20, 20], className: '',
    })
    marcador.current = L.marker([-20.75, -51.7], { icon: icone }).addTo(map)
  }

  useEffect(() => {
    if (!coords || !mapObj.current || !marcador.current) return
    const L = (window as any).L
    if (!L) return
    marcador.current.setLatLng([coords.lat, coords.lng])
    mapObj.current.setView([coords.lat, coords.lng], 15)

    if (pedido?.parceiros) {
      const icP = L.divIcon({ html:'<div style="background:#D4A017;padding:4px 8px;border-radius:8px;color:#fff;font-size:11px;font-weight:700;white-space:nowrap">📦 Retirada</div>', className:'' })
      L.marker([pedido.parceiros.lat, pedido.parceiros.lng], { icon: icP }).addTo(mapObj.current)
    }
    if (pedido?.lat_entrega) {
      const icD = L.divIcon({ html:'<div style="background:#22C55E;padding:4px 8px;border-radius:8px;color:#fff;font-size:11px;font-weight:700;white-space:nowrap">🏠 Destino</div>', className:'' })
      L.marker([pedido.lat_entrega, pedido.lng_entrega], { icon: icD }).addTo(mapObj.current)
    }
  }, [coords, pedido])

  const navUrl = pedido
    ? `https://www.google.com/maps/dir/?api=1&destination=${pedido.lat_entrega},${pedido.lng_entrega}`
    : ''

  return (
    <div style={s.wrap}>
      <div style={s.topbar}>
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <span style={s.titulo}>Mapa GPS</span>
        {navUrl && (
          <a href={navUrl} target="_blank" rel="noreferrer" style={s.btnNav}>🧭 Navegar</a>
        )}
      </div>

      <div ref={mapRef} style={s.mapa} />

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
            <span style={s.infoV}>{pedido.clientes?.nome ?? '—'}</span>
          </div>
          <a href={`https://wa.me/55${pedido.clientes?.telefone?.replace(/\D/g,'')}?text=Olá, sou o entregador do seu pedido CompreFácil+. Estou a caminho!`}
            target="_blank" rel="noreferrer" style={s.btnWhats}>
            💬 WhatsApp cliente
          </a>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', height:'100vh', margin:-16, fontFamily:"'Nunito', sans-serif" },
  topbar: { background:AZUL, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, zIndex:10 },
  voltar: { background:'none', border:'none', color:'rgba(255,255,255,0.8)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  titulo: { flex:1, color:'#fff', fontSize:15, fontWeight:800 },
  btnNav: { background:DOURADO, color:'#fff', padding:'7px 14px', borderRadius:10, fontSize:12, fontWeight:800, textDecoration:'none' },
  mapa: { flex:1, zIndex:0 },
  info: { background:'#fff', padding:'16px', display:'flex', flexDirection:'column', gap:10, boxShadow:'0 -4px 16px rgba(0,0,0,0.1)' },
  infoRow: { display:'flex', gap:8, alignItems:'flex-start' },
  infoL: { fontSize:11, fontWeight:700, color:'#8A95A5', width:80, flexShrink:0 },
  infoV: { fontSize:13, color:'#1A2340', fontWeight:600, flex:1 },
  btnWhats: { display:'block', padding:'12px', background:'#25D36620', color:'#25D366', borderRadius:10, textAlign:'center' as const, fontSize:13, fontWeight:700, textDecoration:'none', border:'1px solid #25D36630' },
}
