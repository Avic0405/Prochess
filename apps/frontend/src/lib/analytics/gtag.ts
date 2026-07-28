/**
 * Google Analytics 4 (gtag.js) core utility.
 *
 * GA_ENABLED controls whether hits are actually sent: always on in production,
 * opt-in locally via NEXT_PUBLIC_GA_DEBUG=true (so local dev never pollutes real GA data
 * unless a developer explicitly asks for it).
 *
 * GA_DEBUG controls console logging only: on in every non-production build, off in
 * production — independent of whether GA_ENABLED is true, so devs can see what *would*
 * have been sent even when GA itself is disabled.
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '';

const isProd = process.env.NODE_ENV === 'production';
const gaDebugFlag = process.env.NEXT_PUBLIC_GA_DEBUG === 'true';

export const GA_ENABLED = Boolean(GA_MEASUREMENT_ID) && (isProd || gaDebugFlag);
export const GA_DEBUG = !isProd;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

function log(...args: unknown[]) {
  if (GA_DEBUG) console.log('%c[GA]', 'color:#f9ab00;font-weight:bold', ...args);
}

function logError(...args: unknown[]) {
  if (GA_DEBUG) console.error('[GA]', ...args);
}

export function logGAInitialized() {
  log('GA Initialized', GA_ENABLED ? GA_MEASUREMENT_ID : '(disabled — set NEXT_PUBLIC_GA_DEBUG=true to enable locally)');
}

// Guards against duplicate page_view hits from React StrictMode's double-invoked
// effects in development, and from redundant renders that don't actually navigate.
let lastPageviewPath: string | null = null;

export function pageview(path: string) {
  if (!path || path === lastPageviewPath) return;
  lastPageviewPath = path;

  if (!GA_ENABLED) {
    log('Page View (not sent — GA disabled):', path);
    return;
  }
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    logError('gtag not initialized — dropped page_view for', path);
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
  log('Page View:', path);
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!GA_ENABLED) {
    log(`Custom Event (not sent — GA disabled): ${name}`, params);
    return;
  }
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    logError('gtag not initialized — dropped event', name);
    return;
  }

  window.gtag('event', name, params);
  log(`Custom Event: ${name}`, params);
}
