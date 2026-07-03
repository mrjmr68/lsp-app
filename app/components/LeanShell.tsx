import Link from 'next/link'

export default function LeanShell({
  title,
  eyebrow,
  backHref,
  backLabel = 'Back',
  children,
}: {
  title: string
  eyebrow?: string
  backHref?: string
  backLabel?: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-dvh bg-neutral-50 text-neutral-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-5">
        <header className="mb-5">
          {backHref && (
            <Link href={backHref} className="mb-5 inline-flex min-h-11 items-center text-base font-black text-neutral-600">
              {backLabel}
            </Link>
          )}
          {eyebrow && (
            <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
              {eyebrow}
            </p>
          )}
          <h1 className="text-4xl font-black leading-none tracking-[-0.05em] text-neutral-950">
            {title}
          </h1>
        </header>
        {children}
      </div>
    </main>
  )
}

export function BigButton({
  children,
  tone = 'dark',
  type = 'button',
  disabled = false,
}: {
  children: React.ReactNode
  tone?: 'dark' | 'green' | 'gold' | 'red' | 'plain'
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const tones = {
    dark: 'border-neutral-950 bg-neutral-950 text-white',
    green: 'border-emerald-800 bg-emerald-700 text-white',
    gold: 'border-amber-700 bg-amber-500 text-neutral-950',
    red: 'border-red-800 bg-red-700 text-white',
    plain: 'border-neutral-300 bg-white text-neutral-950',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={`min-h-16 w-full rounded-2xl border px-5 text-left text-lg font-black shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

export function BigLink({
  href,
  children,
  tone = 'dark',
}: {
  href: string
  children: React.ReactNode
  tone?: 'dark' | 'green' | 'gold' | 'red' | 'plain'
}) {
  const tones = {
    dark: 'border-neutral-950 bg-neutral-950 text-white',
    green: 'border-emerald-800 bg-emerald-700 text-white',
    gold: 'border-amber-700 bg-amber-500 text-neutral-950',
    red: 'border-red-800 bg-red-700 text-white',
    plain: 'border-neutral-300 bg-white text-neutral-950',
  }

  return (
    <Link
      href={href}
      className={`flex min-h-16 w-full items-center rounded-2xl border px-5 text-lg font-black shadow-sm transition active:scale-[0.99] ${tones[tone]}`}
    >
      {children}
    </Link>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-neutral-500">
      {children}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-14 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-lg font-bold text-neutral-950 outline-none focus:border-neutral-950 ${props.className ?? ''}`}
    />
  )
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-36 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-lg font-bold leading-relaxed text-neutral-950 outline-none focus:border-neutral-950 ${props.className ?? ''}`}
    />
  )
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-14 w-full rounded-2xl border border-neutral-300 bg-white px-4 text-lg font-bold text-neutral-950 outline-none focus:border-neutral-950 ${props.className ?? ''}`}
    />
  )
}
