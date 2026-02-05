import type { Location } from "react-router-dom";

/**
 * Navigation utilities for consistent URL building
 */

/**
 * Get the full current route from a location object.
 * Includes pathname, search params, and hash.
 */
export const currentRoute = (location: Location): string => {
  return `${location.pathname}${location.search}${location.hash || ""}`;
};

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
 * 
 * @example
 * const location = useLocation();
 * navigate(exercisePathWithReturn("photo-naming", location));
 */
export const exercisePathWithReturn = (
  exerciseSlug: string, 
  location: Location
): string => {
  return withReturnTo(`/exercise/${exerciseSlug}`, currentRoute(location));
};
