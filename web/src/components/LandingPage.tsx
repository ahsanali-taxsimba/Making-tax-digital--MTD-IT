"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEMO_USERS } from "@/lib/demo";
import { homePath } from "@/lib/roles";
import { setSelectedClientId, startDemoSession } from "@/lib/session";

const WORKSPACES = [
  {
    kind: "practice" as const,
    kicker: "Accountants",
    title: "Practice workspace",
    detail: "VAT, ITSA, bank feeds, documents and HMRC connections for one firm only.",
  },
  {
    kind: "client" as const,
    kicker: "Clients",
    title: "Client portal",
    detail: "Each client sees only their own VAT periods, ITSA updates and files.",
  },
  {
    kind: "admin" as const,
    kicker: "Platform",
    title: "Owner console",
    detail: "Firm counts and health only. Client records stay inside each practice.",
  },
];

const FEATURES = [
  { title: "MTD VAT", detail: "Obligations, digital links and boxed returns from the ledger." },
  { title: "MTD ITSA", detail: "Quarterly updates, EOPS and final declaration for the self-employed." },
  { title: "HMRC connection", detail: "User-restricted OAuth. Tokens stay encrypted on the server." },
  { title: "Bank and receipts", detail: "Yapily or CSV feeds, matching, categorisation and evidence." },
  { title: "Digital records", detail: "Documents stay attached to the journal, VAT box or ITSA line." },
  { title: "Practice control", detail: "Staff, tasks and clients never leak across firms." },
];

export function LandingPage() {
  const router = useRouter();

  function openDemo(kind: keyof typeof DEMO_USERS) {
    const user = DEMO_USERS[kind];
    startDemoSession(user);
    if (user.clientId) {
      setSelectedClientId(user.clientId);
    }
    router.replace(homePath(user));
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-sm font-bold text-white">MT</span>
            <span>
              <span className="block text-sm font-semibold text-ink">Making Tax Digital</span>
              <span className="block text-xs text-ink-muted">VAT and Income Tax for UK practices</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <button type="button" className="hidden text-sm font-semibold text-teal sm:inline" onClick={() => openDemo("practice")}>
              Explore sample
            </button>
            <Link href="/login" className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">HMRC Making Tax Digital</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              One practice system for VAT, ITSA and the records HMRC expect to see.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted">
              Northbridge-style workspaces for accountants, their clients, and the platform owner. Digital links stay
              attached from bank line to submitted return.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-xl bg-teal px-5 py-3 text-sm font-semibold text-white hover:bg-teal-dark">
                Sign in to your firm
              </Link>
              <button
                type="button"
                className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink hover:border-teal/40"
                onClick={() => openDemo("practice")}
              >
                Open the sample practice
              </button>
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Practice home</p>
            <p className="mt-2 text-lg font-semibold text-ink">Northbridge Accountants LLP</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-ink-muted">Open VAT</p>
                <p className="mt-1 text-2xl font-semibold">1</p>
                <p className="text-xs text-ink-muted">Amelia Hartley · 26A1</p>
              </div>
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-ink-muted">Open ITSA</p>
                <p className="mt-1 text-2xl font-semibold">1</p>
                <p className="text-xs text-ink-muted">2025-26 Q1</p>
              </div>
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-ink-muted">HMRC connected</p>
                <p className="mt-1 text-2xl font-semibold">1</p>
                <p className="text-xs text-ink-muted">Sandbox VAT</p>
              </div>
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-ink-muted">Unmatched bank</p>
                <p className="mt-1 text-2xl font-semibold">4</p>
                <p className="text-xs text-ink-muted">To code or match</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-3">
            {WORKSPACES.map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => openDemo(item.kind)}
                className="rounded-2xl border border-line bg-paper p-6 text-left hover:border-teal/40"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{item.kicker}</p>
                <h2 className="mt-2 text-xl font-semibold text-ink">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{item.detail}</p>
                <p className="mt-4 text-sm font-semibold text-teal">Open sample →</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-ink">Built around the MTD record, not a spreadsheet dump</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((item) => (
              <div key={item.title} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-6 py-8 text-center text-xs text-ink-muted">
        Making Tax Digital IT · separate from TaxSimba · HMRC sandbox until live credentials are attached
      </footer>
    </div>
  );
}
