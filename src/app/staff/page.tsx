"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/brand";
import { browserClient } from "@/lib/supabase/browser";
import { api } from "@/lib/client-api";
import { LockKeyhole, ArrowRight } from "lucide-react";
export default function Staff() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const client = browserClient();
      await client.auth.signOut();
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error)
        throw new Error(
          "Unable to sign in. Check your staff email and password.",
        );
      try {
        await api("/api/admin/profiles");
      } catch (e) {
        await client.auth.signOut();
        throw e;
      }
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  return (
    <>
      <Header />
      <main id="main" className="staff-main">
        <section className="focus-card staff-card">
          <div className="persona-icon">
            <LockKeyhole size={26} />
          </div>
          <span className="eyebrow">ADVISOR ACCESS</span>
          <h1>Welcome back.</h1>
          <p>Sign in to manage student registrations.</p>
          <form onSubmit={login}>
            <label htmlFor="email">Staff email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Signing in…" : "Staff Login"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="privacy-note">
            Staff accounts are provided by your program administrator.
          </p>
        </section>
      </main>
    </>
  );
}
