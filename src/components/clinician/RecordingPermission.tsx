import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function RecordingPermission({ profileId, name }: { profileId: string; name: string }) {
  const client = useQueryClient();
  const key = ["clinician-recording-permission",profileId];
  const [message, setMessage] = useState("");
  const permission = useQuery({
    queryKey: key, staleTime: 0, retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("clinician_recording_permissions")
        .select("profile_id").eq("profile_id",profileId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const change = useMutation({
    mutationFn: async (allow: boolean) => {
      const q = supabase.from("clinician_recording_permissions");
      const { error } = allow ? await q.insert({ profile_id:profileId }) : await q.delete().eq("profile_id",profileId);
      if (error) throw error;
    },
    onSuccess: (_, allow) => {
      client.setQueryData(key,allow);
      setMessage(allow ? "Clinician playback enabled." : "Clinician playback turned off.");
    },
    onSettled: () => client.invalidateQueries({ queryKey:key }),
  });
  return <div className="space-y-2 rounded-md border p-4">
    <h3 className="font-medium">Share practice recordings with assigned clinicians</h3>
    <p className="text-sm text-muted-foreground">Allow the clinicians assigned to {name} to play this patient’s recorded practice. You can turn sharing off here. Previously issued playback links expire automatically.</p>
    {permission.isPending ? <p role="status">Checking permission…</p> : permission.isError ?
      <Button variant="outline" onClick={() => permission.refetch()}>Retry permission lookup</Button> :
      <Button variant="outline" disabled={change.isPending || permission.isFetching} onClick={() => { setMessage(""); change.mutate(!permission.data); }}>
        {permission.data ? "Turn off clinician playback" : "Allow clinician playback"}
      </Button>}
    {change.isError ? <p role="alert" className="text-sm">Could not save this change. Check the setting and try again.</p> :
      message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
