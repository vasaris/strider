'use client';

// Registers the install/activate-only service worker (public/sw.js). Renders nothing.
import { useEffect } from 'react';

export function SwRegister(): null {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Registration failure is non-fatal: the app works without a service worker.
      });
  }, []);
  return null;
}
