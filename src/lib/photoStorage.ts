import { supabase } from '@/integrations/supabase/client';

// Note: For better performance with multiple uploads, use the Web Worker compression
// via the useImageCompressor hook instead of this direct compression function.
// Example usage:
//   import { useImageCompressor } from '@/hooks/useImageCompressor';
//   const compress = useImageCompressor();
//   const compressedFile = await compress(file);

// Compress image before upload (max 1600px, quality 0.7)
const compressImage = (file: File): Promise<File> => {
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

export const uploadPhoto = async (userId: string, file: File) => {
  // Compress image before upload
  const compressedFile = await compressImage(file);
  const filePath = `${userId}/${Date.now()}_${file.name}`;
  
  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filePath, compressedFile);

  if (uploadError) throw uploadError;

  // Save metadata to database
  const { data, error: dbError } = await supabase
    .from('photos')
    .insert({
      user_id: userId,
      name: file.name.replace(/\.[^/.]+$/, ""),
      storage_path: filePath,
      labels: []
    })
    .select()
    .single();

  if (dbError) throw dbError;
  return data;
};

// Cache for signed URLs with expiration
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export const getSignedPhotoUrl = async (storagePath: string, expiresIn: number = 3600) => {
  const now = Date.now();
  const cached = urlCache.get(storagePath);
  
  // Return cached URL if still valid (with 60s buffer)
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }
  
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  
  // Cache the new URL
  urlCache.set(storagePath, {
    url: data.signedUrl,
    expiresAt: now + (expiresIn * 1000)
  });
  
  return data.signedUrl;
};

export const getUserPhotos = async (userId: string) => {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const deletePhoto = async (photoId: string, storagePath: string) => {
  // Clear from cache
  urlCache.delete(storagePath);
  
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('photos')
    .remove([storagePath]);

  if (storageError) throw storageError;

  // Delete from database
  const { error: dbError } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId);

  if (dbError) throw dbError;
};

export const updatePhotoLabels = async (photoId: string, labels: string[]) => {
  const { error } = await supabase
    .from('photos')
    .update({ labels })
    .eq('id', photoId);

  if (error) throw error;
};
