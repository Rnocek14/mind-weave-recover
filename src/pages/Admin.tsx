import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, ChevronLeft, Image as ImageIcon, Loader2, Database, Brain, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ClinicalReviewDashboard from "@/components/ClinicalReviewDashboard";

interface Photo {
  id: string;
  name: string;
  storage_path: string;
  labels: string[];
  created_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [labels, setLabels] = useState("");
  const [computingProfile, setComputingProfile] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const hasAdminRole = roles?.some(r => r.role === "admin");
        
        if (!hasAdminRole) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access the admin panel.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        setIsAdmin(true);
        await loadPhotos();
      } catch (error) {
        console.error("Error checking admin status:", error);
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user, authLoading, navigate, toast]);

  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error("Error loading photos:", error);
      toast({
        title: "Error",
        description: "Failed to load photos",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      if (!photoName) {
        setPhotoName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !photoName || !user) return;

    setUploading(true);
    try {
      // Upload to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Save metadata to database
      const labelArray = labels
        .split(",")
        .map(l => l.trim())
        .filter(l => l.length > 0);

      const { error: dbError } = await supabase
        .from("photos")
        .insert({
          user_id: user.id,
          name: photoName,
          storage_path: filePath,
          labels: labelArray,
        });

      if (dbError) throw dbError;

      toast({
        title: "Success!",
        description: "Photo uploaded successfully",
      });

      // Reset form
      setSelectedFile(null);
      setPhotoName("");
      setLabels("");
      await loadPhotos();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: Photo) => {
    if (!confirm(`Delete "${photo.name}"?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("photos")
        .remove([photo.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .eq("id", photo.id);

      if (dbError) throw dbError;

      toast({
        title: "Deleted",
        description: "Photo deleted successfully",
      });

      await loadPhotos();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPhotoUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from("photos")
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <Button
            variant="outline"
            onClick={() => navigate("/admin/research-export")}
          >
            <Database className="w-4 h-4 mr-2" />
            Research Export
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage photos, review utterances, and compute speech profiles
          </p>
        </div>

        <Tabs defaultValue="review" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="review" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Clinical Review
            </TabsTrigger>
            <TabsTrigger value="photos" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Photo Library
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            <ClinicalReviewDashboard />
          </TabsContent>

          <TabsContent value="photos" className="space-y-6">
            {/* Upload Section */}
            <Card className="p-6 shadow-card">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload New Photo
              </h2>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Photo File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="name">Photo Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., red apple, blue car, etc."
                    value={photoName}
                    onChange={(e) => setPhotoName(e.target.value)}
                    disabled={uploading}
                  />
                </div>

                <div>
                  <Label htmlFor="labels">Labels (comma-separated)</Label>
                  <Input
                    id="labels"
                    placeholder="e.g., apple, fruit, food"
                    value={labels}
                    onChange={(e) => setLabels(e.target.value)}
                    disabled={uploading}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Add labels to help categorize and search photos
                  </p>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !photoName || uploading}
                  className="bg-gradient-healing"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Photo
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Photo Library */}
            <Card className="p-6 shadow-card">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Photo Library ({photos.length})
              </h2>

              {photos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No photos uploaded yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {photos.map((photo) => (
                    <Card key={photo.id} className="overflow-hidden">
                      <div className="aspect-square bg-muted relative">
                        <img
                          src={getPhotoUrl(photo.storage_path)}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold mb-2">{photo.name}</h3>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {photo.labels.map((label, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {label}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Uploaded {new Date(photo.created_at).toLocaleDateString()}
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDelete(photo)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="tools">
            <Card className="p-6 shadow-card">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5" />
                User Speech Profile
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Compute personalized cue efficacy profile from exercise trial data. This analyzes which cue types work best for the current user.
              </p>
              <Button
                onClick={async () => {
                  if (!user) return;
                  setComputingProfile(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('compute-speech-profile', {
                      body: { user_id: user.id }
                    });

                    if (error) throw error;

                    console.log('Speech profile computed:', data);
                    toast({
                      title: "Profile Computed",
                      description: `Processed ${data.eventsProcessed} exercise events successfully.`,
                    });
                  } catch (error) {
                    console.error('Error computing profile:', error);
                    toast({
                      title: "Error",
                      description: error instanceof Error ? error.message : "Failed to compute speech profile",
                      variant: "destructive",
                    });
                  } finally {
                    setComputingProfile(false);
                  }
                }}
                disabled={computingProfile || !user}
                className="bg-gradient-healing"
              >
                {computingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Computing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Recompute Speech Profile
                  </>
                )}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
