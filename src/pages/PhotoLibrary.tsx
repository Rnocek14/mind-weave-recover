import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Camera, Upload, Trash2 } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserPhotos, uploadPhoto, deletePhoto, updatePhotoLabels } from '@/lib/photoStorage';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSignedUrl } from '@/hooks/useSignedUrl';


const PhotoCard = ({ photo }: { photo: any }) => {
  const { url, loading } = useSignedUrl(photo.storage_path);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deletePhoto(photo.id, photo.storage_path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-photos'] });
      toast({ title: 'Photo deleted' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Delete failed', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <div className="w-full h-48 bg-muted animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden group relative">
      <img 
        src={url || ''} 
        alt={photo.labels?.[0] || 'Photo'}
        className="w-full h-48 object-cover"
      />
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate">
          {photo.labels?.[0] || photo.name}
        </h3>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="w-full mt-2"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </Card>
  );
};

export default function PhotoLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  const { data: photos, isLoading } = useQuery({
    queryKey: ['user-photos', user?.id],
    queryFn: () => getUserPhotos(user!.id),
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !user || !label.trim()) {
        throw new Error('Missing required fields');
      }
      const photoRow = await uploadPhoto(user.id, uploadFile);
      await updatePhotoLabels(photoRow.id, [label.trim()]);
      return photoRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-photos'] });
      toast({ title: 'Photo uploaded successfully!' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Upload failed', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setShowUploadDialog(true);
    }
  };

  const resetForm = () => {
    setUploadFile(null);
    setPreviewUrl(null);
    setLabel('');
    setShowUploadDialog(false);
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl font-bold">Photo Library</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => document.getElementById('camera-input')?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            <Button variant="outline" onClick={() => document.getElementById('file-input')?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        <input
          id="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          id="file-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="w-full h-48 bg-muted animate-pulse" />
              </Card>
            ))}
          </div>
        ) : photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <PhotoCard key={photo.id} photo={photo} />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by uploading family photos, familiar objects, or places
            </p>
            <Button onClick={() => document.getElementById('camera-input')?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              Take Your First Photo
            </Button>
          </Card>
        )}

        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Photo Label</DialogTitle>
            </DialogHeader>
            
            {previewUrl && (
              <div className="space-y-4">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-md"
                />
                
                <div>
                  <Label htmlFor="label">What is this?</Label>
                  <Input
                    id="label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Mom, Kitchen, Dog"
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => uploadMutation.mutate()}
                    disabled={!label.trim() || uploadMutation.isPending}
                    className="flex-1"
                  >
                    {uploadMutation.isPending ? 'Uploading...' : 'Save Photo'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={resetForm}
                    disabled={uploadMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
