import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Upload, Image as ImageIcon, X, Plus, ChevronLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { uploadPhoto, getUserPhotos, deletePhoto, getSignedPhotoUrl } from "@/lib/photoStorage";

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
      // Get signed URLs for each photo
      const photosWithUrls = await Promise.all(
        photoData.map(async (photo) => {
          const signedUrl = await getSignedPhotoUrl(photo.storage_path);
          return { ...photo, signedUrl };
        })
      );
      setPhotos(photosWithUrls);
    } catch (error: any) {
      toast({
        title: "Error loading photos",
        description: error.message,
        variant: "destructive"
      });
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
        if (file.type.startsWith('image/')) {
          await uploadPhoto(user.id, file);
        }
      }

      toast({
        title: "Photos uploaded! 📸",
        description: "Photos are now available for therapy exercises"
      });

      await loadPhotos(); // Reload photo list
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (photoId: string, storagePath: string) => {
    try {
      await deletePhoto(photoId, storagePath);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      
      toast({
        title: "Photo deleted",
        description: "Photo removed successfully"
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-calm py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <Button 
          variant="ghost" 
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-healing flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Caregiver Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload personal photos to make speech therapy more meaningful
          </p>
        </div>

        {/* Info Card */}
        <Card className="p-6 mb-8 shadow-card border-l-4 border-primary">
          <h3 className="font-semibold text-lg mb-2">Why Personal Photos?</h3>
          <p className="text-muted-foreground mb-3">
            Familiar faces, places, and objects from your loved one's life create stronger 
            emotional connections, leading to better speech recovery outcomes.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ Photos of family members, pets, favorite places</li>
            <li>✓ Common household items they use daily</li>
            <li>✓ Hobbies, interests, and meaningful memories</li>
          </ul>
        </Card>

        {/* Upload Section */}
        <Card className="p-8 mb-8 shadow-card">
          <div className="text-center">
            <Label htmlFor="photo-upload">
              <div className="border-2 border-dashed border-primary rounded-xl p-12 cursor-pointer hover:bg-primary-glow transition-smooth">
                <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
                <p className="font-semibold text-lg mb-2">Upload Photos</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click to select multiple images (JPG, PNG)
                </p>
                <Button type="button" className="bg-gradient-healing" disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {uploading ? "Uploading..." : "Choose Files"}
                </Button>
              </div>
            </Label>
            <Input
              id="photo-upload"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </Card>

        {/* Photo Grid */}
        {photos.length > 0 && (
          <Card className="p-6 shadow-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                Uploaded Photos ({photos.length})
              </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div 
                  key={photo.id} 
                  className="relative group rounded-lg overflow-hidden shadow-card hover:shadow-glow transition-smooth"
                >
                  <img 
                    src={photo.signedUrl || "/placeholder.svg"} 
                    alt={photo.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-smooth flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemovePhoto(photo.id, photo.storage_path)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-sm truncate">{photo.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {photos.length === 0 && (
          <Card className="p-12 text-center shadow-card">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No photos yet</h3>
            <p className="text-muted-foreground">
              Upload photos above to get started
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Caregiver;
