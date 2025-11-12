import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Upload, Image as ImageIcon, X, Plus, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const Caregiver = () => {
  const [photos, setPhotos] = useState<{ id: string; name: string; preview: string }[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const newPhoto = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name.replace(/\.[^/.]+$/, ""),
            preview: event.target?.result as string
          };
          setPhotos(prev => [...prev, newPhoto]);
        };
        reader.readAsDataURL(file);
      }
    });

    toast({
      title: "Photos uploaded successfully! 📸",
      description: "These will be used in speech therapy exercises"
    });
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleSave = () => {
    // Store photos in localStorage for now (later: Supabase Storage)
    localStorage.setItem("caregiverPhotos", JSON.stringify(photos));
    
    toast({
      title: "Changes saved! ✓",
      description: `${photos.length} photos ready for therapy sessions`
    });
  };

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
                <Button type="button" className="bg-gradient-healing">
                  <Plus className="w-4 h-4 mr-2" />
                  Choose Files
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
              <Button onClick={handleSave} className="bg-gradient-healing">
                Save Changes
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div 
                  key={photo.id} 
                  className="relative group rounded-lg overflow-hidden shadow-card hover:shadow-glow transition-smooth"
                >
                  <img 
                    src={photo.preview} 
                    alt={photo.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-smooth flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removePhoto(photo.id)}
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
