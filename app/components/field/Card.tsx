import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  accent?: boolean
}

export default function Card({ children, className = '', accent = false }: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border p-4',
        accent
          ? 'border-stone-800 bg-stone-900 text-stone-50 shadow-lg'
          : 'border-stone-200 bg-white shadow-sm',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}
