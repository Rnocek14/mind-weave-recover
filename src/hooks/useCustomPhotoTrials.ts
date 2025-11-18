import { useQuery } from '@tanstack/react-query';
import { getUserPhotos } from '@/lib/photoStorage';
import { getSignedPhotoUrl } from '@/lib/photoStorage';
import { PhotoTrial } from '@/data/photoBank';

const convertUserPhotoToTrial = async (photo: any): Promise<PhotoTrial> => {
  const signedUrl = await getSignedPhotoUrl(photo.storage_path);
  const label = photo.labels?.[0] || photo.name;
  
  return {
    id: photo.id,
    imageUrl: signedUrl,
    target: label,
    semanticFoils: generateSimpleSemanticFoils(label),
    category: 'personal',
    features: {
      frequency_rank: 1000,
      imageability: 6,
      concreteness: 6,
      age_of_acquisition: 4,
      syllable_count: Math.max(1, label.split(/[aeiou]/gi).length - 1),
      phoneme_count: label.length,
      phonological_complexity: 1,
      neighborhood_density: 'moderate' as const,
      first_phoneme: `/${label[0]?.toLowerCase() || 'a'}/`,
      semantic_category: 'personal',
      typicality_rating: 3,
      part_of_speech: 'noun' as const,
    },
    computed_difficulty: 2,
    minLevel: 1,
    maxLevel: 5,
  };
};

const generateSimpleSemanticFoils = (target: string): string[] => {
  const commonFoils = ['person', 'place', 'thing', 'object', 'item'];
  return commonFoils.filter(f => f.toLowerCase() !== target.toLowerCase()).slice(0, 3);
};

export const useCustomPhotoTrials = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['custom-photo-trials', userId],
    queryFn: async () => {
      if (!userId) return [];
      const photos = await getUserPhotos(userId);
      return Promise.all(photos.map(convertUserPhotoToTrial));
    },
    enabled: !!userId,
  });
};
