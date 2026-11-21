/**
 * Device detection utility for Apex Drift
 * Differentiates mobile smartphones/tablets from desktop/laptop computers.
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('device') === 'mobile') return true;
  if (urlParams.get('device') === 'desktop') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const mobileRegex = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;

  // True mobile phone: has mobile UA or is a handheld touch device
  const isMobileUA = mobileRegex.test(userAgent);
  const isSmallTouchScreen = isTouch && Math.min(window.innerWidth, window.innerHeight) <= 768;

  return isMobileUA || isSmallTouchScreen;
};
