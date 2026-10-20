"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { homePath } from "@/lib/roles";
import { setSelectedClientId } from "@/lib/session";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("marco.r@example.org");
  const [password, setPassword] = useState("PracticeAdmin123!");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result.user.clientId) {
        setSelectedClientId(result.user.clientId);
      }
      router.replace(homePath(result.user));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Your role opens one workspace only: the platform console, your firm&apos;s practice, or your own client
        portal.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm">
        {error ? <ErrorBanner title="Sign-in failed" message={error} /> : null}
        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Password</span>
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Continue"}
        </button>
      </form>
      <div className="mt-6 space-y-2 text-xs text-ink-muted">
        <p>
          Platform: <span className="font-medium text-ink">grace.l@example.com</span> / PlatformAdmin123!
        </p>
        <p>
          Firm: <span className="font-medium text-ink">marco.r@example.org</span> / PracticeAdmin123!
        </p>
        <p>
          Client: <span className="font-medium text-ink">tom.h@example.org</span> / PracticeAdmin123!
        </p>
      </div>
    </div>
  );
}
