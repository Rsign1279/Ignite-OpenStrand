// Staff cookies are installed by a server route, outside Supabase's browser
// client. Notify other tabs without persisting any identity or student content.
const CHANNEL = "ignite-session-change-v1";
export function announceSessionChange() {
  if (typeof window === "undefined") return;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage("changed");
      channel.close();
    } else {
      localStorage.setItem(CHANNEL, crypto.randomUUID());
      localStorage.removeItem(CHANNEL);
    }
  } catch {
    // Identity-pinned API requests remain the server-enforced fallback.
  }
}
export function onSessionChange(callback: () => void) {
  let channel: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (event) => {
        if (event.data === "changed") callback();
      };
    }
  } catch {
    // Browsers can disable cross-tab messaging in private contexts.
  }
  const storage = (event: StorageEvent) => {
    if (event.key === CHANNEL && event.newValue) callback();
  };
  window.addEventListener("storage", storage);
  return () => {
    channel?.close();
    window.removeEventListener("storage", storage);
  };
}
