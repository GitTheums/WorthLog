let fallbackSequence = 0;

/**
 * Temporary client-only identifier for UI state (e.g. toasts).
 * Safe on plain HTTP LAN where `crypto.randomUUID` may be unavailable.
 * Never use for persisted database IDs — those are created by the server.
 */
export function createClientId(): string {
  try {
    const id = globalThis.crypto.randomUUID();
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  } catch {
    // `randomUUID` is missing or throws outside secure contexts (LAN HTTP).
  }

  fallbackSequence += 1;
  const time = Date.now().toString(36);
  const seq = fallbackSequence.toString(36);
  const entropy = Math.random().toString(36).slice(2, 10);
  return `tmp-${time}-${seq}-${entropy}`;
}
