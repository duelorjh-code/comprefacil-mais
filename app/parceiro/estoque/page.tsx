'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, formatBRL } from '@/lib/constants'

export default function ParceiroEstoque() {
  const [itens, setItens]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca]   = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('parceiros').select('id').eq('usuario_id', user.id).single()
    if (!p) return

    const { data } = await supabase.from('estoque')
      .select(`id, preco, quantidade, ativo, produtos ( id, nome, categoria, imagem_url, unidade_medida, descricao )`)
      .eq('parceiro_id', p.id)
      .order('atualizado_em', { ascending: false })
    setItens(data ?? [])
    setLoading(false)
  }

  async function salvar(id: string, preco: number, quantidade: number) {
    setSalvando(id)
    await supabase.from('estoque').update({ preco, quantidade }).eq('id', id)
    setSalvando(null)
  }

  function atualizar(id: string, campo: 'preco' | 'quantidade', valor: string) {
    setItens(prev => prev.map(it =>
      it.id === id ? { ...it, [campo]: campo === 'preco' ? parseFloat(valor) || 0 : parseInt(valor) || 0 } : it
    ))
  }

  const filtrados = itens.filter(it =>
    !busca || (it.produtos?.nome ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <h1 style={s.titulo}>Meu estoque</h1>
      <p style={s.aviso}>📋 Foto, nome e categoria são controlados pelo Admin. Você edita apenas <strong>preço</strong> e <strong>quantidade</strong>.</p>

      <input style={s.busca} placeholder="🔍  Buscar produto…" value={busca} onChange={e => setBusca(e.target.value)} />

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : (
        <div style={s.lista}>
          {filtrados.map(it => (
            <div key={it.id} style={s.card}>
              <div style={s.cardLeft}>
                {it.produtos?.imagem_url
                  ? <img src={it.produtos.imagem_url} alt="" style={s.img} />
                  : <div style={s.imgPlaceholder}>📦</div>
                }
                <div>
                  <div style={s.prodNome}>{it.produtos?.nome}</div>
                  <div style={s.prodMeta}>{it.produtos?.categoria} · {it.produtos?.unidade_medida}</div>
                  {it.produtos?.descricao && <div style={s.prodDesc}>{it.produtos.descricao}</div>}
                </div>
              </div>

              <div style={s.campos}>
                <div style={s.campo}>
                  <label style={s.label}>Preço (R$)</label>
                  <input style={s.inputNum}
                    type="number" min="0" step="0.01"
                    value={it.preco}
                    onChange={e => atualizar(it.id, 'preco', e.target.value)}
                    onBlur={() => salvar(it.id, it.preco, it.quantidade)}
                  />
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Qtd</label>
                  <input style={s.inputNum}
                    type="number" min="0" step="1"
                    value={it.quantidade}
                    onChange={e => atualizar(it.id, 'quantidade', e.target.value)}
                    onBlur={() => salvar(it.id, it.preco, it.quantidade)}
                  />
                </div>
                <div style={{ display:'flex', alignItems:'flex-end' }}>
                  {salvando === it.id
                    ? <span style={{ fontSize:12, color: VERDE }}>💾 Salvo</span>
                    : <span style={{ ...s.qtdCor, color: it.quantidade === 0 ? VERMELHO : it.quantidade <= 5 ? '#F59E0B' : VERDE }}>
                        {it.quantidade === 0 ? 'Sem estoque' : it.quantidade <= 5 ? 'Estoque baixo' : 'Ok'}
                      </span>
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display:'flex', flexDirection:'column', gap:16 },
  titulo: { fontSize:22, fontWeight:800, color:TEXTO },
  aviso: { fontSize:13, color:TEXTO_MEIO, background:'#EEF2FF', borderRadius:10, padding:'10px 14px' },
  busca: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:10, padding:'10px 14px', fontSize:14, background:'#fff', outline:'none', fontFamily:'inherit', color:TEXTO, width:'100%' },
  loading: { display:'flex', justifyContent:'center', padding:60 },
  spinner: { width:32, height:32, borderRadius:'50%', border:`3px solid ${AZUL}30`, borderTopColor:AZUL, display:'block' },
  lista: { display:'flex', flexDirection:'column', gap:10 },
  card: { background:'#fff', borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 6px rgba(27,47,94,0.06)', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' as const },
  cardLeft: { display:'flex', alignItems:'center', gap:12, flex:1, minWidth:200 },
  img: { width:52, height:52, borderRadius:10, objectFit:'cover', flexShrink:0 },
  imgPlaceholder: { width:52, height:52, borderRadius:10, background:'#F4F6FB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 },
  prodNome: { fontSize:14, fontWeight:800, color:TEXTO },
  prodMeta: { fontSize:11, color:TEXTO_MEIO, marginTop:2, textTransform:'capitalize' as const },
  prodDesc: { fontSize:11, color:TEXTO_MEIO, marginTop:2 },
  campos: { display:'flex', gap:12, alignItems:'flex-end' },
  campo: { display:'flex', flexDirection:'column', gap:4 },
  label: { fontSize:10, fontWeight:700, color:TEXTO_MEIO, textTransform:'uppercase' as const },
  inputNum: { border:`1.5px solid ${CINZA_BORDA}`, borderRadius:8, padding:'8px 10px', fontSize:14, fontWeight:700, color:AZUL, width:90, outline:'none', textAlign:'center' as const, fontFamily:'inherit' },
  qtdCor: { fontSize:11, fontWeight:700 },
}
