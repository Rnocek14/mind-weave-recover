import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Upload, Image as ImageIcon, X, ChevronLeft, Loader2, BarChart3, AlertCircle, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { uploadPhoto, getUserPhotos, deletePhoto, getSignedPhotoUrl } from "@/lib/photoStorage";
import { useCaregiverAnalytics } from "@/hooks/useCaregiverAnalytics";
import { CaregiverSummary } from "@/components/CaregiverSummary";
import { FlaggedSessions } from "@/components/FlaggedSessions";
import { SessionAdherenceTracker } from "@/components/SessionAdherenceTracker";
import { EngagementAnalyticsDashboard } from "@/components/EngagementAnalyticsDashboard";

interface PhotoWithUrl {
  id: string;
  name: string;
  storage_path: string;
  labels: string[];
  signedUrl?: string;
}

const Caregiver = () => {
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { summary, flaggedSessions, isLoading: analyticsLoading } = useCaregiverAnalytics(user?.id || null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (user) {
      loadPhotos();
    }
  }, [user, authLoading, navigate]);

  const loadPhotos = async () => {
    if (!user) return;
    try {
      const photoData = await getUserPhotos(user.id);
      const photosWithUrls = await Promise.all(
        photoData.map(async (photo) => {
          const signedUrl = await getSignedPhotoUrl(photo.storage_path);
          return { ...photo, signedUrl };
        })
      );
      setPhotos(photosWithUrls);
    } catch (error: any) {
      toast({ title: "Error loading photos", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) await uploadPhoto(user.id, file);
      }
      toast({ title: "Photos uploaded! 📸", description: "Photos are now available for therapy exercises" });
      await loadPhotos();
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (photoId: string, storagePath: string) => {
    try {
      await deletePhoto(photoId, storagePath);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      toast({ title: "Photo deleted", description: "Photo removed successfully" });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-gradient-calm flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/")}><ChevronLeft className="w-4 h-4 mr-2" />Back to Home</Button>
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-healing flex items-center justify-center mb-4"><Heart className="w-8 h-8 text-white" /></div>
          <h1 className="text-4xl font-bold text-primary mb-2">Caregiver Dashboard</h1>
          <p className="text-muted-foreground">Manage therapy content and monitor progress</p>
        </div>
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4"><TabsTrigger value="summary"><BarChart3 className="h-4 w-4 mr-2" />Summary</TabsTrigger><TabsTrigger value="flags"><AlertCircle className="h-4 w-4 mr-2" />Flagged</TabsTrigger><TabsTrigger value="adherence"><Calendar className="h-4 w-4 mr-2" />Adherence</TabsTrigger><TabsTrigger value="photos"><ImageIcon className="h-4 w-4 mr-2" />Photos</TabsTrigger></TabsList>
          <TabsContent value="summary" className="space-y-6">{analyticsLoading ? <Card><div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Card> : summary ? <><CaregiverSummary summary={summary} />{user && <EngagementAnalyticsDashboard userId={user.id} />}</> : <Card><div className="text-center py-12"><p className="text-muted-foreground">No data available yet</p></div></Card>}</TabsContent>
          <TabsContent value="flags">{analyticsLoading ? <Card><div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Card> : <FlaggedSessions sessions={flaggedSessions} />}</TabsContent>
          <TabsContent value="adherence">{user && <SessionAdherenceTracker userId={user.id} />}</TabsContent>
          <TabsContent value="photos" className="space-y-6"><Card className="p-6"><h2 className="text-2xl font-bold text-primary mb-2">Personal Photos</h2><p className="text-muted-foreground mb-6">Upload meaningful photos for personalized therapy</p><div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors"><Label htmlFor="photo-upload" className="cursor-pointer"><div className="flex flex-col items-center gap-4"><div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">{uploading ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <Upload className="w-8 h-8 text-primary" />}</div><div><p className="font-medium text-lg">{uploading ? "Uploading..." : "Click to upload"}</p><p className="text-sm text-muted-foreground mt-1">JPG, PNG (max 10MB)</p></div></div></Label><Input id="photo-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} /></div></Card>{photos.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{photos.map(photo => <Card key={photo.id} className="overflow-hidden group relative"><div className="aspect-square relative"><img src={photo.signedUrl} alt={photo.name} className="w-full h-full object-cover" /><Button variant="destructive" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemovePhoto(photo.id, photo.storage_path)}><X className="w-4 h-4" /></Button></div><div className="p-3"><p className="text-sm font-medium truncate">{photo.name}</p></div></Card>)}</div> : <Card className="p-12 text-center"><ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" /><h3 className="text-xl font-semibold mb-2">No photos yet</h3></Card>}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Caregiver;
