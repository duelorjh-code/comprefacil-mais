'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, RODAPE, formatBRL, calcTaxaEntrega, calcSlaMinutos, calcConveniencia, distanciaKm, CARRINHO_MINIMO, linkWhats } from '@/lib/constants'

export default function CarrinhoPage() {
  const router = useRouter()
  const [carrinho, setCarrinho] = useState<any[]>([])
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null)
  const [endereco, setEndereco] = useState('')
  const [loading, setLoading]   = useState(false)
  const [loadingPagamento, setLoadingPagamento] = useState(false)
  const [pixData, setPixData]   = useState<any>(null)
  const [slaModal, setSlaModal] = useState(false)
  const [semEntregador, setSemEntregador] = useState(false)
  const [pedidoId, setPedidoId] = useState('')

  useEffect(() => {
    try { const r = localStorage.getItem('cfm_carrinho'); if (r) setCarrinho(JSON.parse(r)) } catch {}
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }))
    }
  }, [])

  function atualizar(estoqueId: string, d: number) {
    const novo = carrinho.map(i => i.estoqueId === estoqueId ? { ...i, quantidade: Math.max(0, i.quantidade + d) } : i).filter(i => i.quantidade > 0)
    setCarrinho(novo)
    localStorage.setItem('cfm_carrinho', JSON.stringify(novo))
  }

  const valorProdutos = carrinho.reduce((a, i) => a + i.preco * i.quantidade, 0)

  // Usa o parceiro do primeiro item para calcular taxas
  const parceiroRef = carrinho[0]
  const dist = coords && parceiroRef ? distanciaKm(coords.lat, coords.lng, parceiroRef.parceiroLat, parceiroRef.parceiroLng) : 0
  const taxaEntrega  = dist > 0 ? calcTaxaEntrega(dist) : 6
  const slaMinutos   = dist > 0 ? calcSlaMinutos(dist) : 40
  const taxaConv     = calcConveniencia(valorProdutos)
  const total        = valorProdutos + taxaEntrega + taxaConv

  async function verificarEPagar() {
    if (!coords) return alert('Permita o acesso à localização para continuar.')
    if (valorProdutos < CARRINHO_MINIMO) return alert(`Valor mínimo do pedido: ${formatBRL(CARRINHO_MINIMO)}`)
    if (!endereco.trim()) return alert('Informe o endereço de entrega.')

    setLoading(true)
    // Verifica disponibilidade
    const { data: check } = await fetch('/api/logistica/verificar-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parceiroId: parceiroRef?.parceiroId, lat: coords.lat, lng: coords.lng }),
    }).then(r => r.json()).catch(() => ({ data: null }))

    setLoading(false)

    if (check?.semEntregador) { setSemEntregador(true); return }

    if (slaMinutos > 60) { setSlaModal(true); return }
    await criarPedidoEPagar()
  }

  async function criarPedidoEPagar() {
    setSlaModal(false)
    setLoadingPagamento(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: cliente } = await supabase.from('clientes').select('id').eq('usuario_id', user!.id).single()

    // Cria pedido
    const { data: pedido, error } = await supabase.from('pedidos').insert({
      cliente_id:         cliente!.id,
      parceiro_id:        parceiroRef?.parceiroId,
      lat_entrega:        coords!.lat,
      lng_entrega:        coords!.lng,
      endereco_entrega:   endereco,
      valor_produtos:     valorProdutos,
      taxa_entrega:       taxaEntrega,
      taxa_conveniencia:  taxaConv,
      total,
      distancia_km:       dist,
      cliente_aceitou_sla: true,
    }).select().single()

    if (error || !pedido) { setLoadingPagamento(false); return alert('Erro ao criar pedido.') }

    // Insere itens
    await supabase.from('pedido_itens').insert(
      carrinho.map(i => ({
        pedido_id:     pedido.id,
        produto_id:    i.produtoId,
        quantidade:    i.quantidade,
        preco_unitario: i.preco,
        subtotal:      i.preco * i.quantidade,
      }))
    )
    setPedidoId(pedido.id)

    // Gera PIX
    const r = await fetch('/api/pagamento/gerar-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedido.id }),
    }).then(r => r.json()).catch(() => null)

    setLoadingPagamento(false)
    if (r?.qr_code) { setPixData(r); } else { alert('Erro ao gerar PIX.') }
  }

  // Polling pagamento
  useEffect(() => {
    if (!pedidoId || !pixData) return
    const interval = setInterval(async () => {
      const { data: p } = await supabase.from('pedidos').select('status').eq('id', pedidoId).single()
      if (p?.status === 'pago') {
        clearInterval(interval)
        localStorage.removeItem('cfm_carrinho')
        router.replace(`/pedido?id=${pedidoId}`)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [pedidoId, pixData])

  if (carrinho.length === 0) return (
    <div style={s.page}>
      <div style={s.topbar}><button onClick={() => router.back()} style={s.voltar}>← Voltar</button></div>
      <div style={s.vazio}>
        <div style={{ fontSize:56 }}>🛒</div>
        <h2 style={{ fontSize:18, fontWeight:800, color:TEXTO }}>Seu carrinho está vazio</h2>
        <button onClick={() => router.push('/vitrine')} style={s.btnIr}>Ver produtos</button>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <span style={s.topTitulo}>Carrinho</span>
      </div>

      <div style={s.conteudo}>
        {/* Itens */}
        <div style={s.secao}>
          {carrinho.map(item => (
            <div key={item.estoqueId} style={s.item}>
              {item.imagem_url && <img src={item.imagem_url} alt="" style={s.itemImg} />}
              <div style={s.itemInfo}>
                <div style={s.itemNome}>{item.nome}</div>
                <div style={s.itemPreco}>{formatBRL(item.preco)}</div>
              </div>
              <div style={s.itemControle}>
                <button onClick={() => atualizar(item.estoqueId, -1)} style={s.qBtn}>−</button>
                <span style={s.qNum}>{item.quantidade}</span>
                <button onClick={() => atualizar(item.estoqueId, +1)} style={s.qBtn}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Endereço */}
        <div style={s.secao}>
          <label style={s.label}>📍 Endereço de entrega</label>
          <input style={s.input} placeholder="Rua, número, bairro…"
            value={endereco} onChange={e => setEndereco(e.target.value)} />
        </div>

        {/* Resumo */}
        <div style={s.resumo}>
          <div style={s.resumoRow}><span>Subtotal</span><span>{formatBRL(valorProdutos)}</span></div>
          <div style={s.resumoRow}><span>Entrega ({dist.toFixed(1)}km)</span><span>{formatBRL(taxaEntrega)}</span></div>
          <div style={s.resumoRow}>
            <span style={{ color:DOURADO, fontWeight:700 }}>+ Taxa de conveniência ⓘ</span>
            <span style={{ color:DOURADO, fontWeight:700 }}>{formatBRL(taxaConv)}</span>
          </div>
          <div style={s.resumoRow}><span style={s.resumoL}>⏱ Estimativa</span><span style={s.resumoL}>~{slaMinutos} min</span></div>
          <div style={{ ...s.resumoRow, ...s.resumoTotal }}>
            <span>Total</span><span>{formatBRL(total)}</span>
          </div>
        </div>

        {valorProdutos < CARRINHO_MINIMO && (
          <p style={s.minAviso}>Valor mínimo de {formatBRL(CARRINHO_MINIMO)} para finalizar.</p>
        )}

        <button onClick={verificarEPagar} disabled={loading || loadingPagamento}
          style={{ ...s.btnPagar, opacity: (loading || loadingPagamento) ? 0.7 : 1 }}>
          {loading ? 'Verificando…' : loadingPagamento ? 'Gerando PIX…' : '💳 Pagar com PIX'}
        </button>
      </div>

      {/* QR Code PIX */}
      {pixData && (
        <div style={s.overlay}>
          <div style={s.pixModal} className="anim-fadeUp">
            <h3 style={s.pixTitulo}>Pague com PIX</h3>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixData.qr_code)}`} alt="QR PIX" style={s.qrImg} />
            <p style={s.pixInstrucao}>Abra o app do seu banco e escaneie o QR Code</p>
            <div style={s.pixCopiaWrap}>
              <input style={s.pixCopia} readOnly value={pixData.qr_code} />
              <button onClick={() => navigator.clipboard.writeText(pixData.qr_code)} style={s.btnCopiar}>Copiar</button>
            </div>
            <p style={s.pixTimer}>⏳ Aguardando confirmação…</p>
            <p style={s.pixExp}>Expira em 30 minutos. Após o pagamento você será redirecionado.</p>
          </div>
        </div>
      )}

      {/* Modal SLA */}
      {slaModal && (
        <div style={s.overlay}>
          <div style={s.slaModal} className="anim-fadeUp">
            <div style={{ fontSize:40 }}>⚠️</div>
            <h3 style={s.pixTitulo}>Atenção</h3>
            <p style={{ fontSize:14, color:TEXTO_MEIO, textAlign:'center' as const, lineHeight:1.6 }}>
              Sua entrega está estimada em <strong style={{ color:VERMELHO }}>{slaMinutos} minutos</strong> devido à distância de {dist.toFixed(1)}km.
            </p>
            <button onClick={criarPedidoEPagar} style={s.btnPagar}>Concordo, prosseguir</button>
            <button onClick={() => setSlaModal(false)} style={s.btnCancelar}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Sem entregador */}
      {semEntregador && (
        <div style={s.overlay}>
          <div style={s.slaModal} className="anim-fadeUp">
            <div style={{ fontSize:40 }}>😔</div>
            <h3 style={s.pixTitulo}>Ops...</h3>
            <p style={{ fontSize:14, color:TEXTO_MEIO, textAlign:'center' as const, lineHeight:1.6 }}>
              No momento não há entregadores disponíveis na sua região. Seu carrinho foi salvo.
            </p>
            <a href={linkWhats('Olá, tentei fazer um pedido mas não há entregadores disponíveis.')} target="_blank" rel="noreferrer" style={s.btnWhats}>💬 Falar com suporte</a>
            <button onClick={() => setSemEntregador(false)} style={s.btnCancelar}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight:'100vh', background:'#F4F6FB', fontFamily:"'Nunito', sans-serif" },
  topbar: { background:AZUL, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:40 },
  voltar: { background:'none', border:'none', color:'rgba(255,255,255,0.8)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  topTitulo: { color:'#fff', fontSize:16, fontWeight:800 },
  vazio: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh', gap:16 },
  btnIr: { padding:'13px 28px', background:AZUL, color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
  conteudo: { padding:'16px', display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto' },
  secao: { background:'#fff', borderRadius:14, padding:'16px', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column', gap:12 },
  item: { display:'flex', alignItems:'center', gap:12 },
  itemImg: { width:48, height:48, borderRadius:10, objectFit:'cover', flexShrink:0 },
  itemInfo: { flex:1 },
  itemNome: { fontSize:13, fontWeight:700, color:TEXTO },
  itemPreco: { fontSize:13, fontWeight:800, color:AZUL },
  itemControle: { display:'flex', alignItems:'center', gap:8 },
  qBtn: { width:30, height:30, borderRadius:8, background:AZUL, color:'#fff', border:'none', fontSize:16, cursor:'pointer', fontFamily:'inherit', fontWeight:800 },
  qNum: { fontSize:15, fontWeight:800, color:AZUL, width:24, textAlign:'center' as const },
  label: { fontSize:12, fontWeight:700, color:TEXTO },
  input: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'12px 14px', fontSize:14, color:TEXTO, outline:'none', fontFamily:'inherit' },
  resumo: { background:'#fff', borderRadius:14, padding:'16px', boxShadow:'0 1px 8px rgba(27,47,94,0.06)', display:'flex', flexDirection:'column', gap:10 },
  resumoRow: { display:'flex', justifyContent:'space-between', fontSize:14, color:TEXTO },
  resumoL: { fontWeight:700, color:TEXTO_MEIO },
  resumoTotal: { borderTop:`2px solid ${CINZA_BORDA}`, paddingTop:10, fontSize:16, fontWeight:800, color:AZUL },
  minAviso: { fontSize:13, color:VERMELHO, background:'#FFF1F1', borderRadius:10, padding:'10px 14px', fontWeight:600 },
  btnPagar: { width:'100%', padding:'16px', background:AZUL, color:'#fff', border:'none', borderRadius:14, fontSize:16, fontWeight:800, cursor:'pointer', fontFamily:'inherit' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  pixModal: { background:'#fff', borderRadius:'20px 20px 0 0', padding:'28px 20px', width:'100%', maxWidth:480, display:'flex', flexDirection:'column', alignItems:'center', gap:14 },
  pixTitulo: { fontSize:18, fontWeight:800, color:TEXTO },
  qrImg: { width:200, height:200, borderRadius:12 },
  pixInstrucao: { fontSize:14, color:TEXTO_MEIO, textAlign:'center' as const },
  pixCopiaWrap: { display:'flex', gap:8, width:'100%' },
  pixCopia: { flex:1, border:`1.5px solid ${CINZA_BORDA}`, borderRadius:8, padding:'10px', fontSize:11, color:TEXTO, fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis' },
  btnCopiar: { padding:'10px 14px', background:AZUL, color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  pixTimer: { fontSize:13, color:DOURADO, fontWeight:700 },
  pixExp: { fontSize:11, color:TEXTO_MEIO, textAlign:'center' as const },
  slaModal: { background:'#fff', borderRadius:'20px 20px 0 0', padding:'28px 20px', width:'100%', maxWidth:480, display:'flex', flexDirection:'column', alignItems:'center', gap:14 },
  btnCancelar: { width:'100%', padding:'13px', border:`1.5px solid ${CINZA_BORDA}`, background:'#fff', color:TEXTO_MEIO, borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnWhats: { display:'block', width:'100%', padding:'13px', background:'#25D36620', color:'#25D366', borderRadius:12, textAlign:'center' as const, fontSize:14, fontWeight:700, textDecoration:'none', border:'1px solid #25D36630' },
}
