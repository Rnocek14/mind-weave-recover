import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { PipelineHealthDashboard } from "@/components/PipelineHealthDashboard";

/**
 * Admin-only pipeline health monitoring page.
 * Requires real admin permissions (not just uiMode).
 */
export default function AdminPipeline() {
  return (
    <AdminProtectedRoute>
      <div className="min-h-dvh bg-background">
        <div className="container max-w-6xl py-6">
          <PipelineHealthDashboard />
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
