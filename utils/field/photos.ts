function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadJobPhotos(jobId: string, type: string, files: File[]) {
  if (!files.length) return

  const { createClient } = await import('@/utils/supabase/client')
  const supabase = createClient()
  const results = await Promise.all(files.map(async (file, index) => {
    const path = `${jobId}/${type}/${Date.now()}-${index}-${safeFileName(file.name)}`
    const { error } = await supabase.storage.from('job-photos').upload(path, file, { upsert: false })
    return { fileName: file.name, error }
  }))

  const failures = results.filter(result => result.error)
  if (failures.length > 0) {
    throw new Error(`Photo upload failed for: ${failures.map(result => result.fileName).join(', ')}`)
  }
}
