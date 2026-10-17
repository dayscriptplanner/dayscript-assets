// DayScript client config — the ONLY file Katie edits after creating the Supabase project.
//
// Both values come from Supabase → Project Settings → API.
//   • Project URL        → SUPABASE_URL
//   • anon / public key  → SUPABASE_ANON_KEY   (safe to ship in the browser; RLS protects data)
//
// NEVER put the service_role key here. It bypasses RLS and belongs only in
// edge-function secrets (Supabase injects it there automatically).

export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...paste-anon-key...';

// Also handy for classic scripts:
if (typeof window !== 'undefined') {
  window.DAYSCRIPT_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY };
}
