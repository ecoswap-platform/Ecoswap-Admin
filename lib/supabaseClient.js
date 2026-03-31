import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────
// Uses the SAME Supabase project as the main EcoSwap application.
// Set these env vars in your admin deployment (.env.local):
//
//   NEXT_PUBLIC_SUPABASE_URL=https://dtymqnfernyfkorvjyra.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=<main-project-anon-key>
// ─────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Set these in .env.local to point at the main EcoSwap Supabase project.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);


