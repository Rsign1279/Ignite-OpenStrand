"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
export function StaffLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { error } = await browserClient().auth.signOut();
            if (error) throw error;
            router.replace("/staff/login");
            router.refresh();
          } catch {
            setError("Unable to sign out. Please try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
