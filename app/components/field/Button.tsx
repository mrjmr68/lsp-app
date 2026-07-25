import { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-blue-700 text-white border-transparent hover:bg-blue-800 disabled:bg-stone-400',
  secondary: 'bg-white text-stone-800 border-stone-300 hover:bg-stone-50',
  ghost: 'bg-transparent text-blue-700 border-transparent hover:bg-blue-50',
}

export default function Button({
  variant = 'secondary',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3',
        'text-sm font-semibold transition-colors disabled:cursor-not-allowed',
        'min-h-[48px] touch-manipulation',
        fullWidth ? 'w-full' : '',
        variantClasses[variant],
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
