import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";

interface Photo {
  id: string;
  name: string;
  storage_path: string;
  labels: string[];
  created_at: string;
}

const PhotoLibraryAdmin = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [labels, setLabels] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

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
    } finally {
      setLoading(false);
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
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

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
      const { error: storageError } = await supabase.storage
        .from("photos")
        .remove([photo.storage_path]);

      if (storageError) throw storageError;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
    </div>
  );
};

export default PhotoLibraryAdmin;
