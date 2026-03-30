export type SupabaseRelation<T> = T | T[] | null | undefined

export function firstRelation<T>(value: SupabaseRelation<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}
