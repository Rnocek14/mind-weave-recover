import { supabase } from '@/integrations/supabase/client';

// Note: For better performance with multiple uploads, use the Web Worker compression
// via the useImageCompressor hook instead of this direct compression function.
// Example usage:
//   import { useImageCompressor } from '@/hooks/useImageCompressor';
//   const compress = useImageCompressor();
//   const compressedFile = await compress(file);

type PhotoRow = {
  id: string; user_id: string; name: string; storage_path: string; labels: string[]; created_at: string;
};

type SignedCacheValue = { url: string; expiresAt: number };
const urlCache = new Map<string, SignedCacheValue>();

// Compress image before upload (max 1600px, quality 0.7)
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      const maxSize = 1600;
      let { width, height } = img;
      
      if (width > height && width > maxSize) {
        height = (height / width) * maxSize;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width / height) * maxSize;
        height = maxSize;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            reject(new Error('Compression failed'));
          }
        },
        'image/jpeg',
        0.7
      );
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export const uploadPhoto = async (userId: string, file: File): Promise<PhotoRow> => {
  const compressedFile = await compressImage(file);
  const filePath = `${userId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, compressedFile);
  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from('photos')
    .insert({ user_id: userId, name: file.name.replace(/\.[^/.]+$/, ''), storage_path: filePath, labels: [] })
    .select()
    .single();

  if (dbError) throw dbError;
  return data as PhotoRow;
};

export const getSignedPhotoUrl = async (storagePath: string, expiresIn = 3600): Promise<string> => {
  const now = Date.now();
  const cached = urlCache.get(storagePath);
  if (cached && cached.expiresAt > now + 60_000) return cached.url;

  const { data, error } = await supabase.storage.from('photos').createSignedUrl(storagePath, expiresIn);
  if (error) throw error;

  urlCache.set(storagePath, { url: data.signedUrl, expiresAt: now + expiresIn * 1000 });
  return data.signedUrl;
};

export const getUserPhotos = async (userId: string): Promise<PhotoRow[]> => {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PhotoRow[];
};

export const deletePhoto = async (photoId: string, storagePath: string): Promise<void> => {
  urlCache.delete(storagePath);
  const { error: storageError } = await supabase.storage.from('photos').remove([storagePath]);
  if (storageError) throw storageError;
  const { error: dbError } = await supabase.from('photos').delete().eq('id', photoId);
  if (dbError) throw dbError;
};

export const updatePhotoLabels = async (photoId: string, labels: string[]) => {
  const { error } = await supabase
    .from('photos')
    .update({ labels })
    .eq('id', photoId);

  if (error) throw error;
};
