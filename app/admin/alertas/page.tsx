'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

export default function MapaEstrategico() {
  const [parceiros, setParceiros]       = useState<any[]>([])
  const [entregadores, setEntregadores] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [selecionado, setSelecionado]   = useState<any | null>(null)
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObj    = useRef<any>(null)
  const marcadores = useRef<any[]>([])

  useEffect(() => {
    carregarDados()
    iniciarMapa()
  }, [])

  useEffect(() => {
    if (mapObj.current) renderizarMarcadores()
  }, [parceiros, entregadores])

  async function carregarDados() {
    setLoading(true)
    const [{ data: parc }, { data: entr }] = await Promise.all([
      supabase.from('parceiros').select('id, nome_fantasia, lat, lng, ativo, categorias').not('lat', 'is', null),
      supabase.from('entregadores').select('id, nome, lat, lng, online').not('lat', 'is', null),
    ])
    setParceiros(parc ?? [])
    setEntregadores(entr ?? [])
    setLoading(false)
  }

  async function iniciarMapa() {
    if (typeof window === 'undefined') return
    if (!mapRef.current || mapObj.current) return

    // Carrega Leaflet via CDN se ainda não estiver carregado
    if (!(window as any).L) {
      await new Promise<void>((resolve, reject) => {
        // CSS
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        document.head.appendChild(link)
        // JS
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
        script.onload = () => resolve()
        script.onerror = () => reject()
        document.head.appendChild(script)
      })
    }

    const L = (window as any).L
    const map = L.map(mapRef.current, {
      center: [-20.7549, -51.7007],
      zoom: 13,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    mapObj.current = map
  }

  async function renderizarMarcadores() {
    if (!mapObj.current) return
    const L = (window as any).L
    if (!L) { await iniciarMapa(); return }

    // Limpar marcadores antigos
    marcadores.current.forEach(m => m.remove())
    marcadores.current = []

    // Marcadores dos parceiros
    parceiros.forEach(p => {
      if (!p.lat || !p.lng) return
      const cor = p.ativo ? '#22C55E' : '#94A3B8'
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:${cor};border:3px solid #fff;
          border-radius:50%;width:18px;height:18px;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          cursor:pointer;
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      const marker = L.marker([p.lat, p.lng], { icon })
        .addTo(mapObj.current)
        .on('click', () => setSelecionado({ tipo: 'parceiro', ...p }))
      marcadores.current.push(marker)
    })

    // Marcadores dos entregadores
    entregadores.forEach(e => {
      if (!e.lat || !e.lng) return
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:${DOURADO};border:3px solid #fff;
          border-radius:4px;width:18px;height:18px;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          cursor:pointer;display:flex;align-items:center;
          justify-content:center;font-size:10px;
        ">🛵</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      const marker = L.marker([e.lat, e.lng], { icon })
        .addTo(mapObj.current)
        .on('click', () => setSelecionado({ tipo: 'entregador', ...e }))
      marcadores.current.push(marker)
    })
  }

  const parcAtivos   = parceiros.filter(p => p.ativo)
  const entrOnline   = entregadores.filter(e => e.online)

  return (
    <div style={s.wrap}>
      {/* Cabeçalho */}
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Mapa Estratégico</h1>
          <p style={s.sub}>Visão geral da operação em Três Lagoas</p>
        </div>
        <button onClick={carregarDados} style={s.btnAtualizar}>🔄 Atualizar</button>
      </div>

      {/* Cards de resumo */}
      <div style={s.cards}>
        <div style={{ ...s.card, borderColor: VERDE }}>
          <div style={s.cardNum}>{parcAtivos.length}</div>
          <div style={s.cardLabel}>🏪 Parceiros online</div>
        </div>
        <div style={{ ...s.card, borderColor: '#94A3B8' }}>
          <div style={{ ...s.cardNum, color: '#94A3B8' }}>{parceiros.length - parcAtivos.length}</div>
          <div style={s.cardLabel}>🏪 Parceiros offline</div>
        </div>
        <div style={{ ...s.card, borderColor: DOURADO }}>
          <div style={{ ...s.cardNum, color: DOURADO }}>{entrOnline.length}</div>
          <div style={s.cardLabel}>🛵 Entregadores online</div>
        </div>
        <div style={{ ...s.card, borderColor: AZUL }}>
          <div style={{ ...s.cardNum, color: AZUL }}>{entregadores.length}</div>
          <div style={s.cardLabel}>🛵 Total entregadores</div>
        </div>
      </div>

      {/* Legenda */}
      <div style={s.legenda}>
        <div style={s.legendaItem}><span style={{ ...s.legendaDot, background: VERDE }} /> Parceiro online</div>
        <div style={s.legendaItem}><span style={{ ...s.legendaDot, background: '#94A3B8' }} /> Parceiro offline</div>
        <div style={s.legendaItem}><span style={{ ...s.legendaDot, background: DOURADO, borderRadius: 3 }} /> Entregador</div>
      </div>

      {/* Mapa */}
      <div style={s.mapaWrap}>
        {loading && (
          <div style={s.mapaLoading}>
            <span className="anim-spin" style={s.spinner} />
            <span style={{ color: TEXTO_MEIO, fontSize: 13 }}>Carregando mapa...</span>
          </div>
        )}
        <div ref={mapRef} style={s.mapa} />

        {/* Popup info ao clicar no marcador */}
        {selecionado && (
          <div style={s.popup}>
            <button onClick={() => setSelecionado(null)} style={s.popupFechar}>✕</button>
            {selecionado.tipo === 'parceiro' ? (
              <>
                <div style={s.popupTipo}>🏪 Parceiro</div>
                <div style={s.popupNome}>{selecionado.nome_fantasia}</div>
                <div style={{ ...s.popupStatus, color: selecionado.ativo ? VERDE : '#94A3B8' }}>
                  ● {selecionado.ativo ? 'Online' : 'Offline'}
                </div>
                {selecionado.categorias?.length > 0 && (
                  <div style={s.popupCats}>
                    {selecionado.categorias.join(' · ')}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={s.popupTipo}>🛵 Entregador</div>
                <div style={s.popupNome}>{selecionado.nome}</div>
                <div style={{ ...s.popupStatus, color: selecionado.online ? VERDE : '#94A3B8' }}>
                  ● {selecionado.online ? 'Online' : 'Offline'}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Lista lateral */}
      <div style={s.listas}>
        <div style={s.listaBox}>
          <div style={s.listaTitulo}>🏪 Parceiros ({parceiros.length})</div>
          {parceiros.map(p => (
            <div key={p.id} style={s.listaItem}
              onClick={() => {
                setSelecionado({ tipo: 'parceiro', ...p })
                if (mapObj.current && p.lat && p.lng) mapObj.current.setView([p.lat, p.lng], 15)
              }}>
              <span style={{ ...s.listaStatus, background: p.ativo ? VERDE : '#94A3B8' }} />
              <span style={s.listaLabel}>{p.nome_fantasia}</span>
              <span style={{ fontSize: 10, color: TEXTO_MEIO }}>{p.ativo ? 'Online' : 'Offline'}</span>
            </div>
          ))}
          {parceiros.length === 0 && <div style={s.vazio}>Nenhum parceiro cadastrado</div>}
        </div>
        <div style={s.listaBox}>
          <div style={s.listaTitulo}>🛵 Entregadores ({entregadores.length})</div>
          {entregadores.map(e => (
            <div key={e.id} style={s.listaItem}
              onClick={() => {
                setSelecionado({ tipo: 'entregador', ...e })
                if (mapObj.current && e.lat && e.lng) mapObj.current.setView([e.lat, e.lng], 15)
              }}>
              <span style={{ ...s.listaStatus, background: e.online ? DOURADO : '#94A3B8' }} />
              <span style={s.listaLabel}>{e.nome}</span>
              <span style={{ fontSize: 10, color: TEXTO_MEIO }}>{e.online ? 'Online' : 'Offline'}</span>
            </div>
          ))}
          {entregadores.length === 0 && <div style={s.vazio}>Nenhum entregador cadastrado</div>}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:         { display: 'flex', flexDirection: 'column', gap: 16 },
  cabecalho:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo:       { fontSize: 22, fontWeight: 800, color: TEXTO, margin: 0 },
  sub:          { fontSize: 13, color: TEXTO_MEIO, marginTop: 4 },
  btnAtualizar: { background: '#F4F6FB', border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: TEXTO },
  cards:        { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  card:         { background: '#fff', borderRadius: 12, padding: '14px 16px', borderTop: '3px solid', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardNum:      { fontSize: 28, fontWeight: 900, color: VERDE, lineHeight: 1 },
  cardLabel:    { fontSize: 12, color: TEXTO_MEIO, fontWeight: 600, marginTop: 4 },
  legenda:      { display: 'flex', gap: 16, alignItems: 'center' },
  legendaItem:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXTO_MEIO, fontWeight: 600 },
  legendaDot:   { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  mapaWrap:     { position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${CINZA_BORDA}`, height: 420 },
  mapaLoading:  { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#F4F6FB', zIndex: 10 },
  spinner:      { width: 24, height: 24, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  mapa:         { width: '100%', height: '100%' },
  popup:        { position: 'absolute', top: 12, right: 12, background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: 180 },
  popupFechar:  { position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: TEXTO_MEIO },
  popupTipo:    { fontSize: 11, fontWeight: 700, color: TEXTO_MEIO, textTransform: 'uppercase' as const, letterSpacing: 1 },
  popupNome:    { fontSize: 15, fontWeight: 800, color: TEXTO, marginTop: 4 },
  popupStatus:  { fontSize: 12, fontWeight: 700, marginTop: 4 },
  popupCats:    { fontSize: 11, color: TEXTO_MEIO, marginTop: 6, lineHeight: 1.5 },
  listas:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  listaBox:     { background: '#fff', borderRadius: 12, border: `1px solid ${CINZA_BORDA}`, overflow: 'hidden' },
  listaTitulo:  { fontSize: 13, fontWeight: 800, color: TEXTO, padding: '12px 16px', borderBottom: `1px solid ${CINZA_BORDA}`, background: '#F8FAFC' },
  listaItem:    { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${CINZA_BORDA}`, cursor: 'pointer' },
  listaStatus:  { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  listaLabel:   { fontSize: 13, fontWeight: 600, color: TEXTO, flex: 1 },
  vazio:        { padding: '20px 16px', fontSize: 13, color: TEXTO_MEIO, textAlign: 'center' as const },
}
