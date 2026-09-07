import { ReactNode } from 'react'

export default function SpokeFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-stone-200 bg-white p-4">
      <div className="mx-auto flex w-full max-w-lg gap-2">{children}</div>
    </div>
  )
}
