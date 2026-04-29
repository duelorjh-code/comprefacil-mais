'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA } from '@/lib/constants'

export default function MapaEstrategico() {
  const [parceiros, setParceiros]     = useState<any[]>([])
  const [entregadores, setEntregadores] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [selecionado, setSelecionado] = useState<any | null>(null)

  useEffect(() => { carregarDados() }, [])

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

  // Converte lat/lng para posição % no mapa
  // Bounding box aproximado de Três Lagoas
  const LAT_MIN = -20.85, LAT_MAX = -20.65
  const LNG_MIN = -51.82, LNG_MAX = -51.60

  function toX(lng: number) {
    return ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100
  }
  function toY(lat: number) {
    return ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * 100
  }

  const parcAtivos = parceiros.filter(p => p.ativo)
  const entrOnline = entregadores.filter(e => e.online)

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Mapa Estratégico</h1>
          <p style={s.sub}>Visão geral da operação em Três Lagoas</p>
        </div>
        <button onClick={carregarDados} style={s.btnAtualizar}>🔄 Atualizar</button>
      </div>

      {/* Cards resumo */}
      <div style={s.cards}>
        {[
          { num: parcAtivos.length,                  label: '🏪 Parceiros online',     cor: VERDE   },
          { num: parceiros.length - parcAtivos.length, label: '🏪 Parceiros offline',    cor: '#94A3B8'},
          { num: entrOnline.length,                  label: '🛵 Entregadores online',   cor: DOURADO },
          { num: entregadores.length,                label: '🛵 Total entregadores',    cor: AZUL    },
        ].map((c, i) => (
          <div key={i} style={{ ...s.card, borderColor: c.cor }}>
            <div style={{ ...s.cardNum, color: c.cor }}>{c.num}</div>
            <div style={s.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div style={s.legenda}>
        <div style={s.legendaItem}><span style={{ ...s.legendaDot, background: VERDE }} /> Parceiro online</div>
        <div style={s.legendaItem}><span style={{ ...s.legendaDot, background: '#94A3B8' }} /> Parceiro offline</div>
        <div style={s.legendaItem}><span style={{ ...s.legendaDot, background: DOURADO, borderRadius: 3 }} /> Entregador</div>
      </div>

      {/* Mapa SVG */}
      {loading ? (
        <div style={s.mapaLoading}>
          <span className="anim-spin" style={s.spinner} />
          <span style={{ color: TEXTO_MEIO, fontSize: 13 }}>Carregando...</span>
        </div>
      ) : (
        <div style={s.mapaWrap}>
          {/* Fundo OpenStreetMap via iframe estático */}
          <iframe
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${LNG_MIN},${LAT_MIN},${LNG_MAX},${LAT_MAX}&layer=mapnik`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            title="Mapa"
          />

          {/* Marcadores sobrepostos */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {parceiros.map(p => {
              if (!p.lat || !p.lng) return null
              const x = toX(p.lng)
              const y = toY(p.lat)
              if (x < 0 || x > 100 || y < 0 || y > 100) return null
              return (
                <div key={p.id}
                  onClick={() => setSelecionado({ tipo: 'parceiro', ...p })}
                  style={{
                    position: 'absolute',
                    left: `${x}%`, top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'all', cursor: 'pointer',
                    width: 16, height: 16, borderRadius: '50%',
                    background: p.ativo ? VERDE : '#94A3B8',
                    border: '2.5px solid #fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    zIndex: 10,
                  }}
                  title={p.nome_fantasia}
                />
              )
            })}
            {entregadores.map(e => {
              if (!e.lat || !e.lng) return null
              const x = toX(e.lng)
              const y = toY(e.lat)
              if (x < 0 || x > 100 || y < 0 || y > 100) return null
              return (
                <div key={e.id}
                  onClick={() => setSelecionado({ tipo: 'entregador', ...e })}
                  style={{
                    position: 'absolute',
                    left: `${x}%`, top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'all', cursor: 'pointer',
                    width: 22, height: 22, borderRadius: 4,
                    background: DOURADO,
                    border: '2.5px solid #fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, zIndex: 10,
                  }}
                  title={e.nome}
                >
                  🛵
                </div>
              )
            })}
          </div>

          {/* Popup */}
          {selecionado && (
            <div style={s.popup}>
              <button onClick={() => setSelecionado(null)} style={s.popupFechar}>✕</button>
              <div style={s.popupTipo}>{selecionado.tipo === 'parceiro' ? '🏪 Parceiro' : '🛵 Entregador'}</div>
              <div style={s.popupNome}>{selecionado.nome_fantasia ?? selecionado.nome}</div>
              <div style={{ ...s.popupStatus, color: (selecionado.ativo || selecionado.online) ? VERDE : '#94A3B8' }}>
                ● {(selecionado.ativo || selecionado.online) ? 'Online' : 'Offline'}
              </div>
              {selecionado.categorias?.length > 0 && (
                <div style={s.popupCats}>{selecionado.categorias.join(' · ')}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Listas */}
      <div style={s.listas}>
        <div style={s.listaBox}>
          <div style={s.listaTitulo}>🏪 Parceiros ({parceiros.length})</div>
          {parceiros.length === 0
            ? <div style={s.vazio}>Nenhum parceiro cadastrado</div>
            : parceiros.map(p => (
              <div key={p.id} style={s.listaItem} onClick={() => setSelecionado({ tipo: 'parceiro', ...p })}>
                <span style={{ ...s.listaStatus, background: p.ativo ? VERDE : '#94A3B8' }} />
                <span style={s.listaLabel}>{p.nome_fantasia}</span>
                <span style={{ fontSize: 10, color: TEXTO_MEIO }}>{p.ativo ? 'Online' : 'Offline'}</span>
              </div>
            ))
          }
        </div>
        <div style={s.listaBox}>
          <div style={s.listaTitulo}>🛵 Entregadores ({entregadores.length})</div>
          {entregadores.length === 0
            ? <div style={s.vazio}>Nenhum entregador cadastrado</div>
            : entregadores.map(e => (
              <div key={e.id} style={s.listaItem} onClick={() => setSelecionado({ tipo: 'entregador', ...e })}>
                <span style={{ ...s.listaStatus, background: e.online ? DOURADO : '#94A3B8' }} />
                <span style={s.listaLabel}>{e.nome}</span>
                <span style={{ fontSize: 10, color: TEXTO_MEIO }}>{e.online ? 'Online' : 'Offline'}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 16 },
  cabecalho:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo:      { fontSize: 22, fontWeight: 800, color: TEXTO, margin: 0 },
  sub:         { fontSize: 13, color: TEXTO_MEIO, marginTop: 4 },
  btnAtualizar:{ background: '#F4F6FB', border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: TEXTO },
  cards:       { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 },
  card:        { background: '#fff', borderRadius: 12, padding: '14px 16px', borderTop: '3px solid', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardNum:     { fontSize: 28, fontWeight: 900, lineHeight: 1 },
  cardLabel:   { fontSize: 12, color: TEXTO_MEIO, fontWeight: 600, marginTop: 4 },
  legenda:     { display: 'flex', gap: 16, alignItems: 'center' },
  legendaItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXTO_MEIO, fontWeight: 600 },
  legendaDot:  { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  mapaLoading: { height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#F4F6FB', borderRadius: 14, border: `1px solid ${CINZA_BORDA}` },
  spinner:     { width: 24, height: 24, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  mapaWrap:    { position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${CINZA_BORDA}`, height: 420 },
  popup:       { position: 'absolute', top: 12, right: 12, background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: 180 },
  popupFechar: { position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: TEXTO_MEIO },
  popupTipo:   { fontSize: 11, fontWeight: 700, color: TEXTO_MEIO, textTransform: 'uppercase' as const, letterSpacing: 1 },
  popupNome:   { fontSize: 15, fontWeight: 800, color: TEXTO, marginTop: 4 },
  popupStatus: { fontSize: 12, fontWeight: 700, marginTop: 4 },
  popupCats:   { fontSize: 11, color: TEXTO_MEIO, marginTop: 6, lineHeight: 1.5 },
  listas:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  listaBox:    { background: '#fff', borderRadius: 12, border: `1px solid ${CINZA_BORDA}`, overflow: 'hidden' },
  listaTitulo: { fontSize: 13, fontWeight: 800, color: TEXTO, padding: '12px 16px', borderBottom: `1px solid ${CINZA_BORDA}`, background: '#F8FAFC' },
  listaItem:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${CINZA_BORDA}`, cursor: 'pointer' },
  listaStatus: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  listaLabel:  { fontSize: 13, fontWeight: 600, color: TEXTO, flex: 1 },
  vazio:       { padding: '20px 16px', fontSize: 13, color: TEXTO_MEIO, textAlign: 'center' as const },
}
