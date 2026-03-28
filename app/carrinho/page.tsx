'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL, calcTaxaEntrega, calcSlaMinutos, calcConveniencia, distanciaKm, CARRINHO_MINIMO, linkWhats } from '@/lib/constants'

type ModoEndereco = 'gps' | 'cep'
type Condominio   = null | 'portaria' | 'entra'

export default function CarrinhoPage() {
  const router = useRouter()
  const [carrinho, setCarrinho]         = useState<any[]>([])
  const [coords, setCoords]             = useState<{lat:number,lng:number}|null>(null)
  const [loadingGps, setLoadingGps]     = useState(false)
  const [modoEnd, setModoEnd]           = useState<ModoEndereco>('gps')
  const [endGps, setEndGps]             = useState('')
  const [cep, setCep]                   = useState('')
  const [rua, setRua]                   = useState('')
  const [numero, setNumero]             = useState('')
  const [complemento, setComplemento]   = useState('')
  const [nomeRecebedor, setNomeRecebedor] = useState('')
  const [condominio, setCondominio]     = useState<Condominio>(null)
  const [loadingCep, setLoadingCep]     = useState(false)
  const [loading, setLoading]           = useState(false)
  const [loadingPix, setLoadingPix]     = useState(false)
  const [pixData, setPixData]           = useState<any>(null)
  const [pedidoId, setPedidoId]         = useState('')
  const [slaModal, setSlaModal]         = useState(false)
  const [semEntregador, setSemEntregador] = useState(false)

  useEffect(() => {
    try { const r = localStorage.getItem('cfm_carrinho'); if (r) setCarrinho(JSON.parse(r)) } catch {}
  }, [])

  // Polling pagamento
  useEffect(() => {
    if (!pedidoId || !pixData) return
    const iv = setInterval(async () => {
      const { data: p } = await supabase.from('pedidos').select('status').eq('id', pedidoId).single()
      if (p?.status === 'pago') {
        clearInterval(iv)
        localStorage.removeItem('cfm_carrinho')
        router.replace(`/pedido?id=${pedidoId}`)
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [pedidoId, pixData])

  function atualizar(estoqueId: string, d: number) {
    const novo = carrinho.map(i => i.estoqueId === estoqueId ? { ...i, quantidade: Math.max(0, i.quantidade + d) } : i).filter(i => i.quantidade > 0)
    setCarrinho(novo)
    localStorage.setItem('cfm_carrinho', JSON.stringify(novo))
  }

  async function capturarGps() {
    setLoadingGps(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setCoords({ lat, lng })
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        const d   = await res.json()
        const end = `${d.address?.road ?? ''}, ${d.address?.house_number ?? ''} - ${d.address?.suburb ?? d.address?.neighbourhood ?? ''}, ${d.address?.city ?? d.address?.town ?? ''}`
        setEndGps(end.trim().replace(/^,|,$/g, ''))
      } catch { setEndGps(`${lat.toFixed(5)}, ${lng.toFixed(5)}`) }
      setLoadingGps(false)
    }, () => {
      alert('Não foi possível capturar a localização. Tente usar o CEP.')
      setLoadingGps(false)
    }, { enableHighAccuracy: true, timeout: 10000 })
  }

  async function buscarCep(v: string) {
    const c = v.replace(/\D/g, '')
    if (c.length !== 8) return
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d   = await res.json()
      if (!d.erro) {
        setRua(d.logradouro)
        // Geocodifica para obter coordenadas
        const geo = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(d.logradouro + ', ' + d.localidade)}&format=json&limit=1`)
        const gd  = await geo.json()
        if (gd[0]) setCoords({ lat: parseFloat(gd[0].lat), lng: parseFloat(gd[0].lon) })
      }
    } catch {}
    setLoadingCep(false)
  }

  const parceiroRef  = carrinho[0]
  const valorProdutos = carrinho.reduce((a, i) => a + i.preco * i.quantidade, 0)
  const dist         = coords && parceiroRef ? distanciaKm(coords.lat, coords.lng, parceiroRef.parceiroLat, parceiroRef.parceiroLng) : 0
  const taxaEntrega  = calcTaxaEntrega(dist || 2)
  const slaMinutos   = calcSlaMinutos(dist || 2)
  const taxaConv     = calcConveniencia(valorProdutos)
  const total        = valorProdutos + taxaEntrega + taxaConv

  function enderecoCompleto() {
    if (modoEnd === 'gps') {
      let e = endGps
      if (numero) e += `, ${numero}`
      if (complemento) e += ` - ${complemento}`
      if (condominio === 'portaria') e += ' [CONDOMÍNIO - PORTARIA]'
      if (condominio === 'entra') e += ' [CONDOMÍNIO - ENTRA]'
      return e
    } else {
      let e = `${rua}, ${numero}`
      if (complemento) e += ` - ${complemento}`
      if (condominio === 'portaria') e += ' [CONDOMÍNIO - PORTARIA]'
      if (condominio === 'entra') e += ' [CONDOMÍNIO - ENTRA]'
      return e
    }
  }

  function enderecoValido() {
    if (modoEnd === 'gps') return !!endGps && !!coords
    return !!rua && !!numero && !!coords
  }

  async function verificarEPagar() {
    if (!enderecoValido()) return alert('Capture sua localização ou preencha o endereço completo.')
    if (valorProdutos < CARRINHO_MINIMO) return alert(`Valor mínimo: ${formatBRL(CARRINHO_MINIMO)}`)
    if (modoEnd === 'cep' && !nomeRecebedor.trim()) return alert('Informe o nome do recebedor.')

    setLoading(true)
    const check = await fetch('/api/logistica/verificar-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parceiroId: parceiroRef?.parceiroId, lat: coords?.lat, lng: coords?.lng }),
    }).then(r => r.json()).catch(() => ({}))
    setLoading(false)

    if (check?.semEntregador) { setSemEntregador(true); return }
    if (slaMinutos > 60) { setSlaModal(true); return }
    await criarPedidoEPagar()
  }

  async function criarPedidoEPagar() {
    setSlaModal(false)
    setLoadingPix(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: cliente }  = await supabase.from('clientes').select('id').eq('usuario_id', user!.id).single()

    const { data: pedido, error } = await supabase.from('pedidos').insert({
      cliente_id:          cliente!.id,
      parceiro_id:         parceiroRef?.parceiroId,
      lat_entrega:         coords!.lat,
      lng_entrega:         coords!.lng,
      endereco_entrega:    enderecoCompleto(),
      nome_recebedor:      modoEnd === 'cep' ? nomeRecebedor : null,
      valor_produtos:      valorProdutos,
      taxa_entrega:        taxaEntrega,
      taxa_conveniencia:   taxaConv,
      total,
      distancia_km:        dist,
      cliente_aceitou_sla: true,
    }).select().single()

    if (error || !pedido) { setLoadingPix(false); return alert('Erro ao criar pedido: ' + error?.message) }

    await supabase.from('pedido_itens').insert(
      carrinho.map(i => ({
        pedido_id:      pedido.id,
        produto_id:     i.produtoId,
        quantidade:     i.quantidade,
        preco_unitario: i.preco,
        subtotal:       i.preco * i.quantidade,
      }))
    )

    setPedidoId(pedido.id)

    const r = await fetch('/api/pagamento/gerar-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedido.id }),
    }).then(r => r.json()).catch(() => null)

    setLoadingPix(false)

    if (r?.qr_code) {
      setPixData(r)
    } else {
      alert('Erro ao gerar PIX: ' + (r?.erro ?? 'Tente novamente.'))
    }
  }

  // ── QR Code PIX ─────────────────────────────────────────────
  if (pixData) return (
    <div style={s.page}>
      <header style={s.topbar}>
        <span style={s.topTitulo}>Pagar com PIX</span>
      </header>
      <div style={s.pixWrap}>
        <div style={s.pixCard}>
          <div style={{ fontSize:48, textAlign:'center' as const }}>📱</div>
          <h2 style={s.pixTitulo}>Escaneie o QR Code</h2>
          <p style={s.pixSub}>Ou copie o código PIX abaixo</p>
          {pixData.qr_base64 && (
            <img src={`data:image/png;base64,${pixData.qr_base64}`} alt="QR PIX"
              style={{ width: 220, height: 220, margin: '0 auto', display: 'block', borderRadius: 12 }} />
          )}
          <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); alert('Código copiado!') }}
            style={s.btnCopiar}>
            📋 Copiar código PIX
          </button>
          <div style={s.pixTotal}>{formatBRL(total)}</div>
          <p style={{ fontSize:12, color:TEXTO_MEIO, textAlign:'center' as const }}>
            Aguardando confirmação do pagamento...
          </p>
          <div style={s.pixLoader}><span className="anim-spin" style={s.spinner} /></div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <span style={s.topTitulo}>Carrinho</span>
      </header>

      <div style={s.conteudo}>
        {/* Itens */}
        {carrinho.length === 0 ? (
          <div style={s.vazio}>
            <div style={{ fontSize:48 }}>🛒</div>
            <p style={{ fontWeight:700, color:TEXTO_MEIO }}>Carrinho vazio</p>
            <button onClick={() => router.replace('/vitrine')} style={s.btnVoltar}>Ver produtos</button>
          </div>
        ) : (
          <>
            <div style={s.card}>
              {carrinho.map(item => (
                <div key={item.estoqueId} style={s.itemRow}>
                  {item.imagem_url && <img src={item.imagem_url} alt={item.nome} style={s.itemFoto} />}
                  <div style={{ flex:1 }}>
                    <div style={s.itemNome}>{item.nome}</div>
                    <div style={s.itemPreco}>{formatBRL(item.preco)}</div>
                  </div>
                  <div style={s.qtdRow}>
                    <button onClick={() => atualizar(item.estoqueId, -1)} style={s.qtdBtn}>−</button>
                    <span style={s.qtdNum}>{item.quantidade}</span>
                    <button onClick={() => atualizar(item.estoqueId, +1)} style={s.qtdBtn}>+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Endereço de entrega */}
            <div style={s.card}>
              <div style={s.cardTitulo}>📍 Endereço de entrega</div>

              {/* Seletor GPS / CEP */}
              <div style={s.modoRow}>
                <button onClick={() => setModoEnd('gps')}
                  style={{ ...s.modoBtn, ...(modoEnd==='gps' ? s.modoBtnAtivo : {}) }}>
                  📡 Usar minha localização
                </button>
                <button onClick={() => setModoEnd('cep')}
                  style={{ ...s.modoBtn, ...(modoEnd==='cep' ? s.modoBtnAtivo : {}) }}>
                  🔍 Outro endereço (CEP)
                </button>
              </div>

              {modoEnd === 'gps' ? (
                <>
                  <button onClick={capturarGps} disabled={loadingGps} style={s.btnGps}>
                    {loadingGps ? '⏳ Capturando...' : endGps ? '🔄 Recapturar localização' : '📡 Capturar localização'}
                  </button>
                  {endGps && (
                    <div style={s.enderecoBox}>
                      <div style={s.enderecoTexto}>{endGps}</div>
                    </div>
                  )}
                  {endGps && (
                    <input style={s.input} placeholder="Número (se necessário)"
                      value={numero} onChange={e => setNumero(e.target.value)} />
                  )}
                </>
              ) : (
                <>
                  <div style={{ display:'flex', gap:8 }}>
                    <input style={{ ...s.input, width:140 }}
                      placeholder="CEP" value={cep} maxLength={9}
                      onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,8); setCep(v); if(v.length===8) buscarCep(v) }} />
                    {loadingCep && <span style={{ fontSize:12, color:TEXTO_MEIO, alignSelf:'center' }}>buscando...</span>}
                  </div>
                  {rua && <input style={s.input} value={rua} onChange={e => setRua(e.target.value)} placeholder="Rua" />}
                  <input style={s.input} placeholder="Número *" value={numero} onChange={e => setNumero(e.target.value)} />
                  <input style={s.input} placeholder="Nome do recebedor *" value={nomeRecebedor} onChange={e => setNomeRecebedor(e.target.value)} />
                </>
              )}

              {/* Complemento */}
              {(endGps || rua) && (
                <input style={s.input} placeholder="Complemento (apto, bloco, referência...)"
                  value={complemento} onChange={e => setComplemento(e.target.value)} />
              )}

              {/* Condomínio */}
              {(endGps || rua) && (
                <div>
                  <div style={s.condLabel}>🏢 É condomínio?</div>
                  <div style={s.condRow}>
                    <button onClick={() => setCondominio(condominio === null ? 'portaria' : null)}
                      style={{ ...s.condBtn, ...(condominio ? s.condBtnAtivo : {}) }}>
                      {condominio ? '✅ Sim' : '○ Não'}
                    </button>
                    {condominio && (
                      <>
                        <button onClick={() => setCondominio('portaria')}
                          style={{ ...s.condOpt, ...(condominio==='portaria' ? s.condOptAtivo : {}) }}>
                          🚪 Entregar na portaria
                        </button>
                        <button onClick={() => setCondominio('entra')}
                          style={{ ...s.condOpt, ...(condominio==='entra' ? s.condOptAtivo : {}) }}>
                          🏠 Entregador entra
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Resumo */}
            {enderecoValido() && (
              <div style={s.card}>
                <div style={s.resumoRow}><span>Subtotal</span><span>{formatBRL(valorProdutos)}</span></div>
                <div style={s.resumoRow}><span>Entrega ({dist > 0 ? dist.toFixed(1) : '~2'}km)</span><span>{formatBRL(taxaEntrega)}</span></div>
                <div style={{ ...s.resumoRow, color:DOURADO }}><span>+ Taxa de conveniência</span><span>{formatBRL(taxaConv)}</span></div>
                <div style={s.resumoRow}><span style={{ fontSize:11, color:TEXTO_MEIO }}>⏱ Estimativa</span><span style={{ fontSize:11, color:TEXTO_MEIO }}>~{slaMinutos} min</span></div>
                <div style={s.divider} />
                <div style={{ ...s.resumoRow, fontSize:16, fontWeight:800, color:AZUL }}>
                  <span>Total</span><span>{formatBRL(total)}</span>
                </div>
              </div>
            )}

            <button onClick={verificarEPagar} disabled={loading || loadingPix || !enderecoValido()}
              style={{ ...s.btnPagar, opacity: (!enderecoValido() || loading || loadingPix) ? 0.5 : 1 }}>
              {loading ? '⏳ Verificando...' : loadingPix ? '⏳ Gerando PIX...' : '💳 Pagar com PIX'}
            </button>
          </>
        )}
      </div>

      {/* Modal SLA */}
      {slaModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ fontSize:40, textAlign:'center' as const }}>⚠️</div>
            <h3 style={s.modalTitulo}>Entrega estimada: ~{slaMinutos} min</h3>
            <p style={{ fontSize:13, color:TEXTO_MEIO, textAlign:'center' as const, lineHeight:1.6 }}>
              Por causa da distância, a entrega pode levar mais de 1 hora. Deseja continuar?
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setSlaModal(false)} style={s.btnCancelarModal}>Cancelar</button>
              <button onClick={criarPedidoEPagar} style={s.btnConfirmarModal}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sem entregador */}
      {semEntregador && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ fontSize:40, textAlign:'center' as const }}>😔</div>
            <h3 style={s.modalTitulo}>Sem entregadores disponíveis</h3>
            <p style={{ fontSize:13, color:TEXTO_MEIO, textAlign:'center' as const }}>Tente novamente em alguns minutos ou fale com o suporte.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setSemEntregador(false)} style={s.btnCancelarModal}>Fechar</button>
              <a href={linkWhats('Olá, tentei fazer um pedido mas não há entregadores disponíveis.')}
                target="_blank" rel="noreferrer" style={{ ...s.btnConfirmarModal, textDecoration:'none', textAlign:'center' as const }}>
                💬 Suporte
              </a>
            </div>
          </div>
        </div>
      )}

      <nav style={s.bottomNav}>
        {[
          { icon:'🏠', label:'Início',   href:'/vitrine' },
          { icon:'🛒', label:'Carrinho', href:'/carrinho' },
          { icon:'📦', label:'Pedido',   href:'/pedido' },
          { icon:'👤', label:'Perfil',   href:'/perfil' },
        ].map(item => (
          <button key={item.href} onClick={() => router.push(item.href)} style={s.navBtn}>
            <span style={{ fontSize:22 }}>{item.icon}</span>
            <span style={s.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:       { minHeight:'100vh', background:'#F4F6FB', fontFamily:"'Nunito',sans-serif", paddingBottom:80 },
  topbar:     { background:AZUL, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:40 },
  voltar:     { background:'none', border:'none', color:'rgba(255,255,255,0.8)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  topTitulo:  { color:'#fff', fontSize:16, fontWeight:800 },
  conteudo:   { padding:'16px', display:'flex', flexDirection:'column', gap:14, maxWidth:520, margin:'0 auto' },
  card:       { background:'#fff', borderRadius:14, padding:'16px', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column', gap:12 },
  cardTitulo: { fontSize:14, fontWeight:800, color:TEXTO },
  itemRow:    { display:'flex', alignItems:'center', gap:12, paddingBottom:10, borderBottom:`1px solid ${CINZA_BORDA}` },
  itemFoto:   { width:48, height:48, borderRadius:8, objectFit:'cover' as const },
  itemNome:   { fontSize:14, fontWeight:700, color:TEXTO },
  itemPreco:  { fontSize:13, color:AZUL, fontWeight:700 },
  qtdRow:     { display:'flex', alignItems:'center', gap:8 },
  qtdBtn:     { width:32, height:32, borderRadius:8, background:AZUL, color:'#fff', border:'none', fontSize:18, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' },
  qtdNum:     { fontSize:15, fontWeight:800, color:TEXTO, minWidth:24, textAlign:'center' as const },
  modoRow:    { display:'flex', gap:8 },
  modoBtn:    { flex:1, padding:'10px 8px', borderRadius:10, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit', textAlign:'center' as const },
  modoBtnAtivo:{ background:AZUL, color:'#fff', borderColor:AZUL },
  btnGps:     { padding:'12px', background:'#EEF2FF', color:AZUL, border:`1.5px solid #C7D2FE`, borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textAlign:'center' as const },
  enderecoBox:{ background:'#F4F6FB', borderRadius:10, padding:'10px 12px' },
  enderecoTexto:{ fontSize:13, color:TEXTO, lineHeight:1.5 },
  input:      { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'11px 13px', fontSize:14, color:TEXTO, background:'#FAFBFE', outline:'none', fontFamily:'inherit', width:'100%' },
  condLabel:  { fontSize:12, fontWeight:700, color:TEXTO_MEIO, marginBottom:6 },
  condRow:    { display:'flex', gap:8, flexWrap:'wrap' as const },
  condBtn:    { padding:'8px 14px', borderRadius:8, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit' },
  condBtnAtivo:{ background:'#DCFCE7', color:VERDE, borderColor:VERDE },
  condOpt:    { padding:'8px 12px', borderRadius:8, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', color:TEXTO_MEIO, fontFamily:'inherit' },
  condOptAtivo:{ background:AZUL, color:'#fff', borderColor:AZUL },
  resumoRow:  { display:'flex', justifyContent:'space-between', fontSize:14, color:TEXTO, fontWeight:600 },
  divider:    { height:1, background:CINZA_BORDA },
  btnPagar:   { padding:'16px', background:AZUL, color:'#fff', border:'none', borderRadius:14, fontSize:16, fontWeight:800, cursor:'pointer', fontFamily:'inherit', textAlign:'center' as const },
  vazio:      { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', gap:12 },
  btnVoltar:  { padding:'12px 24px', background:AZUL, color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal:      { background:'#fff', borderRadius:20, padding:'28px 24px', width:'100%', maxWidth:360, display:'flex', flexDirection:'column', gap:16 },
  modalTitulo:{ fontSize:17, fontWeight:800, color:TEXTO, textAlign:'center' as const },
  btnCancelarModal:{ flex:1, padding:'12px', borderRadius:10, border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', color:TEXTO_MEIO, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnConfirmarModal:{ flex:1, padding:'12px', borderRadius:10, background:AZUL, color:'#fff', border:'none', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  pixWrap:    { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh', padding:20 },
  pixCard:    { background:'#fff', borderRadius:20, padding:'28px 24px', width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:16, boxShadow:'0 4px 24px rgba(0,0,0,0.1)' },
  pixTitulo:  { fontSize:20, fontWeight:800, color:TEXTO, textAlign:'center' as const },
  pixSub:     { fontSize:13, color:TEXTO_MEIO, textAlign:'center' as const },
  btnCopiar:  { padding:'13px', background:'#EEF2FF', color:AZUL, border:`1.5px solid #C7D2FE`, borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textAlign:'center' as const },
  pixTotal:   { fontSize:24, fontWeight:800, color:AZUL, textAlign:'center' as const },
  pixLoader:  { display:'flex', justifyContent:'center' },
  spinner:    { width:24, height:24, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  bottomNav:  { position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #E2E8F0', display:'flex', padding:'6px 0', zIndex:40, boxShadow:'0 -4px 16px rgba(0,0,0,0.06)' },
  navBtn:     { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'4px', fontFamily:'inherit', color:'#94A3B8' },
  navLabel:   { fontSize:10, fontWeight:700 },
}
