import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, Shield, Stethoscope, HeartHandshake, UserPlus } from "lucide-react";

type AppRole = "admin" | "clinician" | "caregiver";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  profile_name: string | null;
}

interface RoleRow {
  id: string;
  user_id: string;
  role: string;
}

interface Assignment {
  id: string;
  caregiver_id?: string;
  clinician_id?: string;
  patient_user_id: string;
  profile_id: string;
}

const ROLE_META: Record<AppRole, { label: string; icon: typeof Shield }> = {
  admin: { label: "Admin", icon: Shield },
  clinician: { label: "Clinician", icon: Stethoscope },
  caregiver: { label: "Caregiver", icon: HeartHandshake },
};

const ASSIGNABLE_ROLES: AppRole[] = ["admin", "clinician", "caregiver"];

export default function UserRoleManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [clinicianAssignments, setClinicianAssignments] = useState<Assignment[]>([]);
  const [caregiverAssignments, setCaregiverAssignments] = useState<Assignment[]>([]);
  const [search, setSearch] = useState("");

  // Assignment form state
  const [assignType, setAssignType] = useState<"clinician" | "caregiver">("clinician");
  const [providerUserId, setProviderUserId] = useState<string>("");
  const [patientProfileId, setPatientProfileId] = useState<string>("");

  const loadAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: ca }, { data: ga }] = await Promise.all([
      supabase.from("profiles").select("id, user_id, display_name, profile_name").order("display_name", { ascending: true }),
      supabase.from("user_roles").select("id, user_id, role"),
      supabase.from("clinician_assignments").select("id, clinician_id, patient_user_id, profile_id").is("revoked_at", null),
      supabase.from("caregiver_assignments").select("id, caregiver_id, patient_user_id, profile_id").is("revoked_at", null),
    ]);
    setProfiles(p ?? []);
    setRoles(r ?? []);
    setClinicianAssignments(ca ?? []);
    setCaregiverAssignments(ga ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const nameFor = (profile: Profile) =>
    profile.display_name || profile.profile_name || "Unnamed";

  // One row per user_id (roles are per-user, not per-profile)
  const users = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profiles) {
      if (!map.has(p.user_id)) map.set(p.user_id, p);
    }
    return Array.from(map.values());
  }, [profiles]);

  const rolesByUser = useMemo(() => {
    const m = new Map<string, RoleRow[]>();
    for (const row of roles) {
      const arr = m.get(row.user_id) ?? [];
      arr.push(row);
      m.set(row.user_id, arr);
    }
    return m;
  }, [roles]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? users.filter((u) =>
          nameFor(u).toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q))
      : users;
    return list.slice(0, 50);
  }, [users, search]);

  const cliniciansList = useMemo(
    () => users.filter((u) => (rolesByUser.get(u.user_id) ?? []).some((r) => r.role === "clinician" || r.role === "moderator" || r.role === "admin")),
    [users, rolesByUser]
  );
  const caregiversList = useMemo(
    () => users.filter((u) => (rolesByUser.get(u.user_id) ?? []).some((r) => r.role === "caregiver")),
    [users, rolesByUser]
  );

  const grantRole = async (userId: string, role: AppRole) => {
    setBusy(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Could not grant role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Granted ${ROLE_META[role].label}` });
      await loadAll();
    }
    setBusy(false);
  };

  const revokeRole = async (roleId: string, label: string) => {
    setBusy(true);
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) {
      toast({ title: "Could not revoke role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Removed ${label}` });
      await loadAll();
    }
    setBusy(false);
  };

  const createAssignment = async () => {
    if (!providerUserId || !patientProfileId) {
      toast({ title: "Pick both a provider and a patient", variant: "destructive" });
      return;
    }
    const patient = profiles.find((p) => p.id === patientProfileId);
    if (!patient) return;
    setBusy(true);
    const table = assignType === "clinician" ? "clinician_assignments" : "caregiver_assignments";
    const providerKey = assignType === "clinician" ? "clinician_id" : "caregiver_id";
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from(table).insert({
      [providerKey]: providerUserId,
      patient_user_id: patient.user_id,
      profile_id: patient.id,
      assigned_by: auth.user?.id ?? null,
    });
    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Could not create assignment", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assignment created" });
      setProviderUserId("");
      setPatientProfileId("");
      await loadAll();
    }
    setBusy(false);
  };

  const revokeAssignment = async (type: "clinician" | "caregiver", id: string) => {
    setBusy(true);
    const table = type === "clinician" ? "clinician_assignments" : "caregiver_assignments";
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from(table)
      .update({ revoked_at: new Date().toISOString(), revoked_by: auth.user?.id ?? null })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not revoke assignment", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assignment revoked" });
      await loadAll();
    }
    setBusy(false);
  };

  const profileById = (id: string) => profiles.find((p) => p.id === id);
  const userById = (uid: string) => users.find((u) => u.user_id === uid);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="roles" className="space-y-4">
      <TabsList>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="assignments">Care Assignments</TabsTrigger>
      </TabsList>

      {/* ROLES TAB */}
      <TabsContent value="roles" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Roles</CardTitle>
            <p className="text-sm text-muted-foreground">
              Everyone starts as a patient. Grant elevated roles only here. Showing up to 50 matches.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by name or user ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
            />
            <div className="divide-y rounded-md border">
              {filteredUsers.map((u) => {
                const userRoles = rolesByUser.get(u.user_id) ?? [];
                const heldRoles = new Set(userRoles.map((r) => r.role));
                return (
                  <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{nameFor(u)}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.user_id}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {userRoles.length === 0 && (
                        <Badge variant="outline" className="text-muted-foreground">Patient</Badge>
                      )}
                      {userRoles.map((r) => {
                        const meta = ROLE_META[r.role as AppRole];
                        return (
                          <Badge key={r.id} variant="secondary" className="gap-1">
                            {meta?.label ?? r.role}
                            <button
                              onClick={() => revokeRole(r.id, meta?.label ?? r.role)}
                              disabled={busy}
                              aria-label={`Remove ${meta?.label ?? r.role} role`}
                              className="ml-1 rounded-full hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                      <Select onValueChange={(v) => grantRole(u.user_id, v as AppRole)}>
                        <SelectTrigger className="h-8 w-[140px]" aria-label="Add role">
                          <Plus className="w-3 h-3 mr-1" />
                          <SelectValue placeholder="Add role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.filter((role) => !heldRoles.has(role)).map((role) => (
                            <SelectItem key={role} value={role}>{ROLE_META[role].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No matching users.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ASSIGNMENTS TAB */}
      <TabsContent value="assignments" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Link a provider to a patient
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Caregivers see only their linked patient. Clinicians can view all patients but write actions require an assignment.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Select value={assignType} onValueChange={(v) => { setAssignType(v as "clinician" | "caregiver"); setProviderUserId(""); }}>
                <SelectTrigger aria-label="Assignment type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinician">Clinician</SelectItem>
                  <SelectItem value="caregiver">Caregiver</SelectItem>
                </SelectContent>
              </Select>
              <Select value={providerUserId} onValueChange={setProviderUserId}>
                <SelectTrigger aria-label="Select provider"><SelectValue placeholder={`Select ${assignType}`} /></SelectTrigger>
                <SelectContent>
                  {(assignType === "clinician" ? cliniciansList : caregiversList).map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{nameFor(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={patientProfileId} onValueChange={setPatientProfileId}>
                <SelectTrigger aria-label="Select patient"><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{nameFor(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={createAssignment} disabled={busy}>Assign</Button>
            </div>
            {(assignType === "clinician" ? cliniciansList : caregiversList).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No users have the {assignType} role yet — grant it on the Roles tab first.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Clinician assignments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {clinicianAssignments.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
            {clinicianAssignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  {userById(a.clinician_id!)?.display_name || userById(a.clinician_id!)?.profile_name || "Clinician"}
                  {" → "}
                  {profileById(a.profile_id) ? nameFor(profileById(a.profile_id)!) : "Patient"}
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => revokeAssignment("clinician", a.id)}>Revoke</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Caregiver assignments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {caregiverAssignments.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
            {caregiverAssignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  {userById(a.caregiver_id!)?.display_name || userById(a.caregiver_id!)?.profile_name || "Caregiver"}
                  {" → "}
                  {profileById(a.profile_id) ? nameFor(profileById(a.profile_id)!) : "Patient"}
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => revokeAssignment("caregiver", a.id)}>Revoke</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
