import { supabase } from "@/integrations/supabase/client";

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

export async function pipelineOpsStats(): Promise<PipelineOpsStats> {
  const { data, error } = await supabase.functions.invoke("pipeline-ops/stats", {
    method: "GET",
  });
  if (error) throw error;
  return data as PipelineOpsStats;
}

export async function pipelineOpsRequeueStuck(minutes = 10): Promise<{ ok: boolean; requeued: number }> {
  const { data, error } = await supabase.functions.invoke("pipeline-ops/requeue-stuck", {
    method: "POST",
    body: { minutes },
  });
  if (error) throw error;
  return data as { ok: boolean; requeued: number };
}

export async function pipelineOpsResetFailed(): Promise<{ ok: boolean; reset: number }> {
  const { data, error } = await supabase.functions.invoke("pipeline-ops/reset-failed", {
    method: "POST",
  });
  if (error) throw error;
  return data as { ok: boolean; reset: number };
}

export async function pipelineOpsBumpPriority(params: { 
  userId?: string; 
  attemptIds?: string[]; 
  priority?: number 
}): Promise<{ ok: boolean; bumped: number }> {
  const { data, error } = await supabase.functions.invoke("pipeline-ops/bump-priority", {
    method: "POST",
    body: params,
  });
  if (error) throw error;
  return data as { ok: boolean; bumped: number };
}
