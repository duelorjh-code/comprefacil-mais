'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

type Cidade = 'tl' | 'b'

interface CidadeCtx {
  cidade: Cidade
  setCidade: (c: Cidade) => void
  isBaruu: boolean
  suffix: string // '' para TL, '_b' para Bauru
}

const CidadeContext = createContext<CidadeCtx>({
  cidade: 'tl',
  setCidade: () => {},
  isBaruu: false,
  suffix: '',
})

export function CidadeProvider({ children }: { children: ReactNode }) {
  const [cidade, setCidade] = useState<Cidade>('tl')
  return (
    <CidadeContext.Provider value={{
      cidade,
      setCidade,
      isBaruu: cidade === 'b',
      suffix: cidade === 'b' ? '_b' : '',
    }}>
      {children}
    </CidadeContext.Provider>
  )
}

export function useCidade() {
  return useContext(CidadeContext)
}
