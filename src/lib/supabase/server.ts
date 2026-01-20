/**
 * Supabase Server Client
 *
 * This file provides a Supabase client configured with the service role key
 * for server-side operations. NEVER import this file from client-side code.
 *
 * Uses:
 * - Uploading files to Supabase Storage
 * - Generating signed URLs for private bucket access
 * - Any admin-level Supabase operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate required environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Create a singleton Supabase admin client
// Using service role key for full access (server-side only)
let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

// Default bucket name from environment
export const VISIT_PROOFS_BUCKET = process.env.SUPABASE_BUCKET || 'visit-proofs';
