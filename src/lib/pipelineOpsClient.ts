import { supabase } from "@/integrations/supabase/client";

// Correct Supabase Edge Functions URL format
const PROJECT_REF = "wjedbpjaiqdxhmjzkcxo";
const FUNCTIONS_URL = `https://${PROJECT_REF}.supabase.co/functions/v1`;
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZWRicGphaXFkeGhtanprY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjgyNjcsImV4cCI6MjA3ODU0NDI2N30.tXfA1zdAqvCsZGKNlfn8OC48fhS4olS88kou0zyR7OA";

export type PipelineOpsStats = {
  ok: boolean;
  stats: {
    counts: {
      pending: number;
      processing: number;
      complete: number;
      failed: number;
      permFailed: number;
      stuckProcessing: number;
    };
    pendingAge: { oldestMin: number; p50Min: number; p90Min: number };
    total: number;
  };
};

/**
 * Get auth headers for edge function calls
 */
async function getAuthHeaders(): Promise<Headers> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers({
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
  });
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  
  return headers;
}

export async function pipelineOpsStats(): Promise<PipelineOpsStats> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${FUNCTIONS_URL}/pipeline-ops/stats`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pipeline ops stats failed: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

export async function pipelineOpsRequeueStuck(minutes = 10): Promise<{ ok: boolean; requeued: number }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${FUNCTIONS_URL}/pipeline-ops/requeue-stuck`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ minutes }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Requeue stuck failed: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

export async function pipelineOpsResetFailed(): Promise<{ ok: boolean; reset: number }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${FUNCTIONS_URL}/pipeline-ops/reset-failed`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Reset failed: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

export async function pipelineOpsBumpPriority(params: { 
  userId?: string; 
  attemptIds?: string[]; 
  priority?: number 
}): Promise<{ ok: boolean; bumped: number }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${FUNCTIONS_URL}/pipeline-ops/bump-priority`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bump priority failed: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}
