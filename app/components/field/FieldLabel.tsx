import { fieldLabelClass } from '@/utils/field/styles'

export default function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className={fieldLabelClass}>{children}</label>
}
