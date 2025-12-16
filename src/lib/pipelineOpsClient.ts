import { supabase } from "@/integrations/supabase/client";

// Use environment variables for Supabase config
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

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

export type PronunciationHealthStatus = {
  ok: boolean;
  configured: boolean;
  hasKey: boolean;
  hasRegion: boolean;
  timestamp: string;
};

export async function pronunciationHealth(): Promise<PronunciationHealthStatus> {
  // Health check uses apikey only - no auth, no Content-Type for clean GET
  const response = await fetch(`${FUNCTIONS_URL}/analyze-pronunciation/health`, {
    method: 'GET',
    headers: { 'apikey': ANON_KEY },
  });
  
  if (!response.ok) {
    throw new Error(`Pronunciation health check failed: ${response.status}`);
  }
  
  return response.json();
}
