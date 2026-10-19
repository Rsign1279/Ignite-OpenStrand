"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/brand";
import { signInStaff } from "@/lib/staff-login-client";
import { LockKeyhole, ArrowRight, Eye, EyeOff } from "lucide-react";
export default function Staff() {
  const router = useRouter();
  const lock = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await signInStaff(email, password);
      setPassword("");
      router.replace("/staff/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
      lock.current = false;
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
          <p>Sign in to view registrations and student interview growth.</p>
          <form onSubmit={login}>
            <label htmlFor="email">Staff email</label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-visibility"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              {showPassword ? "Hide password" : "Show password"}
            </button>
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
            If your password was reset, use the new password rather than a saved
            browser password.
          </p>
        </section>
      </main>
    </>
  );
}
