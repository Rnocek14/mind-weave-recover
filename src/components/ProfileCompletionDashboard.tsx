import { useState } from 'react';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, AlertTriangle, CheckCircle2, FileText, Upload, Loader2, Calendar, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export const ProfileCompletionDashboard = () => {
  const { users, stats, loading, error, refetch } = useProfileCompletion();
  const { toast } = useToast();
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [clinicalNote, setClinicalNote] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleBulkImport = async () => {
    if (!clinicalNote.trim() || !selectedUserId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a user and enter clinical notes',
        variant: 'destructive'
      });
      return;
    }

    try {
      setImporting(true);

      // Call the parse-clinical-notes edge function
      const { data, error: parseError } = await supabase.functions.invoke('parse-clinical-notes', {
        body: { clinicalNote }
      });

      if (parseError) throw parseError;

      if (!data) {
        throw new Error('No data returned from parser');
      }

      // Update the user's profile with the parsed data
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          clinical_profile: data,
          stroke_date: data.stroke_date || null
        })
        .eq('user_id', selectedUserId);

      if (updateError) throw updateError;

      toast({
        title: 'Profile Updated',
        description: 'Clinical profile has been successfully imported and updated'
      });

      setBulkImportOpen(false);
      setClinicalNote('');
      setSelectedUserId(null);
      refetch();
    } catch (err) {
      console.error('Error importing profile:', err);
      toast({
        title: 'Import Failed',
        description: err instanceof Error ? err.message : 'Failed to import clinical profile',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!stats) {
    return null;
  }

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgCompletion}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incomplete Profiles</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.incompleteUsers}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Priority Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.priorityUsers}</div>
            <p className="text-xs text-muted-foreground">Active but incomplete</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Import Button */}
      <div className="flex justify-end">
        <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Import Clinical Notes
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Clinical Profile from Notes</DialogTitle>
              <DialogDescription>
                Select a user and paste their clinical notes to automatically extract their stroke profile
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select User</label>
                <select
                  className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  value={selectedUserId || ''}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Choose a user...</option>
                  {users
                    .filter(u => u.completionPercentage < 100)
                    .map(user => (
                      <option key={user.userId} value={user.userId}>
                        {user.displayName} - {user.completionPercentage}% complete
                        {user.isPriority && ' (Priority)'}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Clinical Notes</label>
                <Textarea
                  placeholder="Paste clinical notes here (e.g., 'Patient had left hemisphere ischemic stroke affecting motor cortex...')"
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  className="min-h-[200px] mt-1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBulkImportOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Import & Update
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Profile Completion</CardTitle>
          <CardDescription>
            Priority users (active but incomplete profiles) are shown first
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Missing Fields</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Stroke Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.userId} className={user.isPriority ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                    <TableCell className="font-medium">
                      {user.displayName}
                      {user.isPriority && (
                        <Badge variant="destructive" className="ml-2">Priority</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Progress value={user.completionPercentage} className="w-20" />
                          <span className={`text-sm font-medium ${getCompletionColor(user.completionPercentage)}`}>
                            {user.completionPercentage}%
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.missingFields.length === 0 ? (
                          <Badge variant="outline" className="text-green-600">Complete</Badge>
                        ) : (
                          user.missingFields.map((field, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {field}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.sessionCount}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastSessionDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(user.lastSessionDate), { addSuffix: true })}
                        </div>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.strokeDate || (
                        <span className="text-muted-foreground italic">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.completionPercentage === 100 ? (
                        <Badge className="bg-green-600">Complete</Badge>
                      ) : user.isPriority ? (
                        <Badge variant="destructive">Urgent</Badge>
                      ) : (
                        <Badge variant="secondary">Incomplete</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
