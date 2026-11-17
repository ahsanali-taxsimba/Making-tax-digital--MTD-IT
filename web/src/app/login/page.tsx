"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ApiError, probeApiHealth } from "@/lib/api";
import { login } from "@/lib/auth";
import { DEMO_USERS } from "@/lib/demo";
import { homePath } from "@/lib/roles";
import { setSelectedClientId, startDemoSession } from "@/lib/session";

const ACCOUNTS = [
  { label: "Practice admin", email: "marco.r@example.org", password: "PracticeAdmin123!" },
  { label: "Client portal", email: "tom.h@example.org", password: "PracticeAdmin123!" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("marco.r@example.org");
  const [password, setPassword] = useState("PracticeAdmin123!");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    void probeApiHealth().then((result) => setApiOk(result.ok));
  }, []);

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

  function openDemo(kind: keyof typeof DEMO_USERS) {
    const user = DEMO_USERS[kind];
    startDemoSession(user);
    if (user.clientId) {
      setSelectedClientId(user.clientId);
    }
    router.replace(homePath(user));
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Making Tax Digital</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your role opens one workspace: the practice, the client portal, or the platform console.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm">
          {apiOk === false ? (
            <ErrorBanner
              title="Live API is still starting"
              message="The sample workspaces below open immediately. Sign-in works once Supabase has finished migrating."
            />
          ) : null}
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
        <p className="mt-4 text-sm text-ink-muted">
          <Link href="/" className="font-semibold text-teal hover:underline">
            Back to the product home
          </Link>
        </p>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Open a sample workspace</h2>
          <p className="mt-1 text-sm text-ink-muted">Walk the product with Northbridge sample data. Nothing is submitted to HMRC.</p>
          <div className="mt-4 grid gap-2">
            <button type="button" className="rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark" onClick={() => openDemo("practice")}>
              Practice
            </button>
            <button type="button" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-teal/40" onClick={() => openDemo("client")}>
              Client portal
            </button>
            <button type="button" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-teal/40" onClick={() => openDemo("admin")}>
              Platform admin
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 text-sm shadow-sm">
          <h2 className="font-semibold text-ink">Seed accounts</h2>
          <p className="mt-1 text-ink-muted">Use these after the API has migrated and seeded Supabase.</p>
          <ul className="mt-3 space-y-2 text-ink-muted">
            {ACCOUNTS.map((account) => (
              <li key={account.email}>
                <span className="font-medium text-ink">{account.label}:</span> {account.email}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
