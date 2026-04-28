import { Suspense } from 'react'
import PedidoConteudo from './conteudo'

export default function PedidoPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', justifyContent:'center', padding:80, fontFamily:"'Nunito',sans-serif" }}>Carregando...</div>}>
      <PedidoConteudo />
    </Suspense>
  )
}
