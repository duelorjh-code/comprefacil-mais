'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, LARANJA, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

export default function AdminEstoque() {
  const [estoque, setEstoque] = useState<any[]>([])
  const [busca, setBusca]     = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase
      .from('estoque')
      .select(`
        id, preco, quantidade, ativo,
        produtos ( nome, categoria, imagem_url, unidade_medida ),
        parceiros ( nome_fantasia )
      `)
      .order('atualizado_em', { ascending: false })
    setEstoque(data ?? [])
    setLoading(false)
  }

  const filtrados = estoque.filter(e =>
    !busca ||
    (e.produtos?.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (e.parceiros?.nome_fantasia ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  const baixoEstoque = filtrados.filter(e => e.quantidade > 0 && e.quantidade <= 5)
  const semEstoque   = filtrados.filter(e => e.quantidade === 0)

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <h1 style={s.titulo}>Estoque</h1>

      {/* Alertas */}
      {(baixoEstoque.length > 0 || semEstoque.length > 0) && (
        <div style={s.alertasBox}>
          {semEstoque.length > 0 && (
            <div style={{ ...s.alertaItem, background:'#FFF1F1', borderColor:'#FEE2E2' }}>
              🔴 <strong>{semEstoque.length}</strong> itens sem estoque
            </div>
          )}
          {baixoEstoque.length > 0 && (
            <div style={{ ...s.alertaItem, background:'#FFFBEB', borderColor:'#FEF3C7' }}>
              🟡 <strong>{baixoEstoque.length}</strong> itens com estoque baixo (≤5)
            </div>
          )}
        </div>
      )}

      <input style={s.busca} placeholder="🔍  Buscar produto ou parceiro…" value={busca} onChange={e => setBusca(e.target.value)} />

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.tabela}>
          <div style={s.thead}>
            <span style={{ flex:2 }}>Produto</span>
            <span style={{ flex:1 }}>Parceiro</span>
            <span style={{ width:80, textAlign:'right' as const }}>Preço</span>
            <span style={{ width:80, textAlign:'center' as const }}>Qtd</span>
            <span style={{ width:70, textAlign:'center' as const }}>Status</span>
          </div>
          {filtrados.map(e => {
            const qtdCor = e.quantidade === 0 ? VERMELHO : e.quantidade <= 5 ? LARANJA : VERDE
            return (
              <div key={e.id} style={s.row}>
                <div style={{ flex:2, display:'flex', alignItems:'center', gap:10 }}>
                  {e.produtos?.imagem_url
                    ? <img src={e.produtos.imagem_url} alt="" style={s.img} />
                    : <div style={s.imgPlaceholder}>📦</div>
                  }
                  <div>
                    <div style={s.prodNome}>{e.produtos?.nome}</div>
                    <div style={s.prodCat}>{e.produtos?.categoria} · {e.produtos?.unidade_medida}</div>
                  </div>
                </div>
                <span style={{ flex:1, fontSize:13, color:TEXTO_MEIO }}>{e.parceiros?.nome_fantasia}</span>
                <span style={{ width:80, textAlign:'right' as const, fontWeight:700, color:AZUL }}>{formatBRL(e.preco)}</span>
                <span style={{ width:80, textAlign:'center' as const, fontWeight:800, color:qtdCor }}>{e.quantidade}</span>
                <span style={{ width:70, textAlign:'center' as const }}>
                  <span style={{ ...s.pill, background: e.ativo ? '#22C55E20' : '#EF444420', color: e.ativo ? VERDE : VERMELHO }}>
                    {e.ativo ? 'Ativo' : 'Off'}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:20 },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  alertasBox: { display:'flex', flexDirection:'column', gap:8 },
  alertaItem: { padding:'10px 14px', borderRadius:10, border:'1px solid', fontSize:13, color:TEXTO },
  busca: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, background:'#fff', outline:'none', fontFamily:'inherit', color:TEXTO, width:'100%' },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:32, height:32, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  tabela: { background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 8px rgba(27,47,94,0.06)' },
  thead: { display:'flex', alignItems:'center', padding:'12px 18px', background:'#F4F6FB', fontSize:11, fontWeight:700, color:TEXTO_MEIO, textTransform:'uppercase' as const, gap:12 },
  row: { display:'flex', alignItems:'center', padding:'14px 18px', borderTop:`1px solid ${CINZA_BORDA}`, gap:12 },
  img: { width:40, height:40, borderRadius:8, objectFit:'cover' },
  imgPlaceholder: { width:40, height:40, borderRadius:8, background:'#F4F6FB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 },
  prodNome: { fontSize:13, fontWeight:700, color:TEXTO },
  prodCat: { fontSize:11, color:TEXTO_MEIO, textTransform:'capitalize' as const },
  pill: { fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, display:'inline-block' },
}
