import Link from 'next/link'
import { ReactNode } from 'react'

interface ActionLinkProps {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
  external?: boolean
}

export default function ActionLink({
  href,
  children,
  variant = 'primary',
  external = false,
}: ActionLinkProps) {
  const className = [
    'inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 py-3',
    'text-base font-semibold no-underline touch-manipulation',
    variant === 'primary'
      ? 'bg-blue-700 text-white'
      : 'border border-stone-300 bg-white text-stone-900',
  ].join(' ')

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
