import { supabase } from '@/integrations/supabase/client';

export const uploadPhoto = async (userId: string, file: File) => {
  const filePath = `${userId}/${Date.now()}_${file.name}`;
  
  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filePath, file);

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

export const getSignedPhotoUrl = async (storagePath: string, expiresIn: number = 3600) => {
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
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
