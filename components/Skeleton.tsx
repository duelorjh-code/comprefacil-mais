'use client'

import { CINZA_BORDA } from '@/lib/constants'

interface SkeletonProps {
  largura?: string | number
  altura?: string | number
  arredondado?: boolean
  className?: string
}

export function Skeleton({ largura = '100%', altura = 16, arredondado = false }: SkeletonProps) {
  return (
    <div style={{
      width: largura,
      height: altura,
      borderRadius: arredondado ? 999 : 8,
      background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shine 1.4s ease infinite',
    }} />
  )
}

export function SkeletonCard({ linhas = 3 }: { linhas?: number }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: 18,
      boxShadow: '0 1px 8px rgba(27,47,94,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <Skeleton altura={18} largura="60%" />
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} altura={13} largura={i % 2 === 0 ? '100%' : '75%'} />
      ))}
    </div>
  )
}

export function SkeletonGrid({ cards = 4, linhas = 2 }: { cards?: number; linhas?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 16,
    }}>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} linhas={linhas} />
      ))}
    </div>
  )
}
