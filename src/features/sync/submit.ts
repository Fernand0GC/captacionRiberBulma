import { supabase } from '@/lib/supabase'
import type { CapturePayload } from './db'
import type { SubmitResult } from './sender'

export async function submitCapture(payload: CapturePayload): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_capture', { p: payload })
  if (error) throw error
  return data as SubmitResult
}
