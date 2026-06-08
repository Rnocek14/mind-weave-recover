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
import { Loader2, Plus, X, Shield, Stethoscope, HeartHandshake, UserPlus, Mail, Trash2 } from "lucide-react";

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

interface Invitation {
  id: string;
  email: string;
  role: string;
  note: string | null;
  used_at: string | null;
  created_at: string;
}

interface RoleRequest {
  id: string;
  user_id: string;
  email: string;
  requested_role: string;
  status: string;
  note: string | null;
  created_at: string;
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

  // Invitation form state
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("clinician");
  const [inviteNote, setInviteNote] = useState("");

  // Self-service role requests
  const [requests, setRequests] = useState<RoleRequest[]>([]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: ca }, { data: ga }, { data: inv }, { data: req }] = await Promise.all([
      supabase.from("profiles").select("id, user_id, display_name, profile_name").order("display_name", { ascending: true }),
      supabase.from("user_roles").select("id, user_id, role"),
      supabase.from("clinician_assignments").select("id, clinician_id, patient_user_id, profile_id").is("revoked_at", null),
      supabase.from("caregiver_assignments").select("id, caregiver_id, patient_user_id, profile_id").is("revoked_at", null),
      supabase.from("role_invitations").select("id, email, role, note, used_at, created_at").order("created_at", { ascending: false }),
      supabase.from("role_requests").select("id, user_id, email, requested_role, status, note, created_at").order("created_at", { ascending: false }),
    ]);
    setProfiles(p ?? []);
    setRoles(r ?? []);
    setClinicianAssignments(ca ?? []);
    setCaregiverAssignments(ga ?? []);
    setInvitations(inv ?? []);
    setRequests(req ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const reviewRequest = async (id: string, decision: "approved" | "rejected") => {
    setBusy(true);
    const { data, error } = await supabase.rpc("review_role_request", {
      p_request_id: id,
      p_decision: decision,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Could not update request", description: error.message, variant: "destructive" });
      return;
    }
    const res = data as { success?: boolean; message?: string } | null;
    toast({
      title: res?.success ? (decision === "approved" ? "Request approved" : "Request rejected") : "No change",
      description: res?.message,
      variant: res?.success ? undefined : "destructive",
    });
    loadAll();
  };

  const createInvitation = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    setBusy(true);

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("role_invitations").insert({
      email,
      role: inviteRole,
      note: inviteNote.trim() || null,
      created_by: auth.user?.id ?? null,
    });
    if (error) {
      toast({
        title: "Could not create invitation",
        description: error.message.includes("duplicate") || error.message.includes("unique")
          ? "An invitation already exists for that email."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: `Invitation created for ${email}` });
      setInviteEmail("");
      setInviteNote("");
      await loadAll();
    }
    setBusy(false);
  };

  const deleteInvitation = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("role_invitations").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not remove invitation", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invitation removed" });
      await loadAll();
    }
    setBusy(false);
  };


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
    const { data: auth } = await supabase.auth.getUser();
    const assignedBy = auth.user?.id ?? null;
    const { error } = assignType === "clinician"
      ? await supabase.from("clinician_assignments").insert({
          clinician_id: providerUserId,
          patient_user_id: patient.user_id,
          profile_id: patient.id,
          assigned_by: assignedBy,
        })
      : await supabase.from("caregiver_assignments").insert({
          caregiver_id: providerUserId,
          patient_user_id: patient.user_id,
          profile_id: patient.id,
          assigned_by: assignedBy,
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
    const { data: auth } = await supabase.auth.getUser();
    const patch = { revoked_at: new Date().toISOString(), revoked_by: auth.user?.id ?? null };
    const { error } = type === "clinician"
      ? await supabase.from("clinician_assignments").update(patch).eq("id", id)
      : await supabase.from("caregiver_assignments").update(patch).eq("id", id);
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
        <TabsTrigger value="requests">
          Requests
          {requests.filter((r) => r.status === "pending").length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {requests.filter((r) => r.status === "pending").length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="invitations">Invitations</TabsTrigger>
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

      {/* REQUESTS TAB */}
      <TabsContent value="requests" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Access requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.filter((r) => r.status === "pending").length === 0 && (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            )}
            {requests
              .filter((r) => r.status === "pending")
              .map((r) => {
                const profile = profiles.find((p) => p.user_id === r.user_id);
                const name = profile?.display_name || profile?.profile_name || r.email;
                const Icon = ROLE_META[r.requested_role as AppRole]?.icon ?? UserPlus;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="font-medium truncate">{name}</span>
                        <Badge variant="secondary">
                          {ROLE_META[r.requested_role as AppRole]?.label ?? r.requested_role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => reviewRequest(r.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => reviewRequest(r.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}

            {requests.some((r) => r.status !== "pending") && (
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Recently reviewed</p>
                <div className="space-y-1">
                  {requests
                    .filter((r) => r.status !== "pending")
                    .slice(0, 10)
                    .map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{r.email}</span>
                        <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                          {r.status}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>



      {/* INVITATIONS TAB */}
      <TabsContent value="invitations" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-4 h-4" /> Pre-authorize a role by email
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              When someone signs up with an invited email, they're automatically granted that role and land in the matching onboarding. Everyone else stays a patient.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Input
                className="sm:col-span-2"
                type="email"
                placeholder="person@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                aria-label="Invitation email"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger aria-label="Invitation role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_META[role].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={createInvitation} disabled={busy}>Invite</Button>
            </div>
            <Input
              placeholder="Optional note (e.g. site, study arm)"
              value={inviteNote}
              onChange={(e) => setInviteNote(e.target.value)}
              aria-label="Invitation note"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Invitations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {invitations.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
            {invitations.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{inv.email}</p>
                  {inv.note && <p className="text-xs text-muted-foreground truncate">{inv.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{ROLE_META[inv.role as AppRole]?.label ?? inv.role}</Badge>
                  {inv.used_at ? (
                    <Badge variant="outline" className="text-muted-foreground">Used</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => deleteInvitation(inv.id)}
                    aria-label={`Remove invitation for ${inv.email}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>


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
