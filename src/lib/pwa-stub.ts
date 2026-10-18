// Stand-in for the PWA service worker in the single-file demo build (no service workers there).
export function registerSW(_opts?: unknown) { return () => Promise.resolve(); }
