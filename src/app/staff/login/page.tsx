"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/brand";
import { signInStaff } from "@/lib/staff-login-client";
import { LockKeyhole, ArrowRight, Eye, EyeOff } from "lucide-react";
const subscribeToClientReady = () => () => {};
export default function Staff() {
  const clientReady = useSyncExternalStore(
    subscribeToClientReady,
    () => true,
    () => false,
  );
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
    <div className="studio staff-studio">
      <Header />
      <main id="main" className="staff-main">
        <section className="focus-card staff-card">
          <div className="persona-icon">
            <LockKeyhole size={26} />
          </div>
          <span className="eyebrow">ADVISOR ACCESS</span>
          <h1>Welcome back.</h1>
          <p>Sign in to review students and practice results.</p>
          <form method="post" onSubmit={login} aria-busy={!clientReady || busy}>
            <label htmlFor="email">Staff email</label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              disabled={!clientReady}
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
              disabled={!clientReady}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-visibility"
              aria-pressed={showPassword}
              disabled={!clientReady}
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
            <button className="button primary" disabled={busy || !clientReady}>
              {!clientReady
                ? "Preparing sign-in…"
                : busy
                  ? "Signing in…"
                  : "Staff Login"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="privacy-note">
            After a reset, enter your new password.
          </p>
        </section>
      </main>
    </div>
  );
}
