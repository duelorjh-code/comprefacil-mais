'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logout } from '@/lib/auth'
import { AZUL, DOURADO, VERDE, VERMELHO, TEXTO, TEXTO_MEIO, CINZA_BORDA, RODAPE } from '@/lib/constants'

export default function EntregadorPerfil() {
  const router = useRouter()
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: e } = await supabase.from('entregadores')
        .select(`cpf, tipo_veiculo, validado, saldo, documento_url,
                 perfis ( nome, telefone, bloqueado )`)
        .eq('usuario_id', user.id).single()
      setDados(e)
      setLoading(false)
    }
    carregar()
  }, [])

  async function handleLogout() { await logout(); router.replace('/') }

  return (
    <div style={s.wrap} className="anim-fadeIn">
      <div style={s.cabecalho}>
        <button onClick={() => router.back()} style={s.voltar}>← Voltar</button>
        <h1 style={s.titulo}>Perfil</h1>
      </div>

      {loading ? (
        <div style={s.loading}><span className="anim-spin" style={s.spinner} /></div>
      ) : dados ? (
        <>
          <div style={s.avatar}>
            <div style={s.avatarCircle}>{dados.perfis?.nome?.charAt(0).toUpperCase()}</div>
            <div>
              <div style={s.nome}>{dados.perfis?.nome}</div>
              <div style={s.tel}>{dados.perfis?.telefone}</div>
            </div>
          </div>

          <div style={s.card}>
            {[
              { label: 'CPF', valor: dados.cpf },
              { label: 'Veículo', valor: dados.tipo_veiculo === 'moto' ? '🏍️ Moto' : '⚡ E-Bike' },
              { label: 'Validação', valor: dados.validado ? '✅ Validado' : '⏳ Pendente' },
              { label: 'Status', valor: dados.perfis?.bloqueado ? '🚫 Bloqueado' : '✅ Ativo' },
            ].map(item => (
              <div key={item.label} style={s.row}>
                <span style={s.rowLabel}>{item.label}</span>
                <span style={s.rowValor}>{item.valor}</span>
              </div>
            ))}
            {dados.documento_url && (
              <div style={s.row}>
                <span style={s.rowLabel}>Documento</span>
                <a href={dados.documento_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: AZUL, fontWeight: 700 }}>Ver arquivo 📄</a>
              </div>
            )}
          </div>

          <button onClick={handleLogout} style={s.btnSair}>🚪 Sair da conta</button>
        </>
      ) : null}

      <p style={s.rodape}>{RODAPE}</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  cabecalho: { display: 'flex', alignItems: 'center', gap: 12 },
  voltar: { background: 'none', border: 'none', color: TEXTO_MEIO, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  titulo: { fontSize: 20, fontWeight: 800, color: TEXTO },
  loading: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: { width: 28, height: 28, borderRadius: '50%', border: `3px solid ${AZUL}30`, borderTopColor: AZUL, display: 'block' },
  avatar: { background: AZUL, borderRadius: 16, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 },
  avatarCircle: { width: 52, height: 52, borderRadius: '50%', background: DOURADO, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 },
  nome: { fontSize: 17, fontWeight: 800, color: '#fff' },
  tel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  card: { background: '#fff', borderRadius: 14, padding: '4px 0', boxShadow: '0 1px 8px rgba(27,47,94,0.06)' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: `1px solid ${CINZA_BORDA}` },
  rowLabel: { fontSize: 13, color: TEXTO_MEIO, fontWeight: 600 },
  rowValor: { fontSize: 13, color: TEXTO, fontWeight: 700 },
  btnSair: { padding: '14px', background: '#fff', border: `1.5px solid ${CINZA_BORDA}`, borderRadius: 12, fontSize: 14, fontWeight: 700, color: TEXTO_MEIO, cursor: 'pointer', fontFamily: 'inherit' },
  rodape: { fontSize: 11, color: '#aaa', textAlign: 'center' as const },
}
