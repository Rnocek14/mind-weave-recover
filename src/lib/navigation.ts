/**
 * Navigation utilities for consistent URL building
 */

/**
 * Build a path with returnTo parameter for smart back navigation.
 * 
 * @example
 * withReturnTo('/exercise/photo-naming', '/insights?tab=progress')
 * // Returns: '/exercise/photo-naming?returnTo=%2Finsights%3Ftab%3Dprogress'
 */
export const withReturnTo = (path: string, returnTo: string): string => {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
};

/**
 * Build exercise path with returnTo from current location.
 * Useful when navigating to exercises from various pages.
 */
export const exercisePathWithReturn = (
  exerciseSlug: string, 
  currentPath: string
): string => {
  return withReturnTo(`/exercise/${exerciseSlug}`, currentPath);
};
