import { useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxDistance?: number;
  enabled?: boolean;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  maxDistance = 120,
  enabled = true,
}: UsePullToRefreshOptions) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number>(0);
  const scrollableRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let isTouching = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the page
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        isTouching = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouching || isRefreshing) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;

      // Only pull down, not up
      if (distance > 0 && window.scrollY === 0) {
        // Apply resistance curve
        const resistance = Math.min(distance * 0.5, maxDistance);
        setPullDistance(resistance);

        // Prevent default scrolling when pulling
        if (resistance > 0) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isTouching) return;
      isTouching = false;

      if (pullDistance > threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(maxDistance); // Snap to full distance

        try {
          await onRefresh();
        } finally {
          // Reset after animation
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 300);
        }
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, isRefreshing, pullDistance, threshold, maxDistance, onRefresh]);

  return {
    isRefreshing,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
  };
};
