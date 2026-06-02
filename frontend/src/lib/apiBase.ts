/**
 * Backend API base URL helper — resolves dynamically from the browser's origin
 * so it works from any host (localhost dev, VPS, custom domain).
 * Falls back to localhost:8000 for SSR/build-time.
 */

export function apiBase(): string {
  if (typeof window === 'undefined') return 'http://localhost:8000/api/v1';
  return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
}

export function wsBase(): string {
  if (typeof window === 'undefined') return 'ws://localhost:8000';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:8000`;
}