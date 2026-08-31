"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/Mark";
import { WalletMenu } from "@/components/WalletMenu";
import { useSession } from "@/lib/session";

const NAV = [
  { href: "/", label: "Index" },
  { href: "/registry/", label: "Registry" },
  { href: "/submit/", label: "File a dispute" },
  { href: "/protocol/", label: "Protocol" },
  { href: "/roadmap/", label: "Roadmap" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { config, wrongNetwork, switchNetwork } = useSession();
  const unconfigured = Boolean(config && !config.contract_configured);

  return (
    <div className="shell">
      <div className="grain" />
      <div className="vignette" />
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link href="/" className="brand">
            <Mark size={28} />
            <span className="brand-name">Forge Layer</span>
          </Link>
          <nav className="nav-desk" aria-label="Primary">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link${active ? " is-active" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="header-right">
            {unconfigured ? <span className="chip">Local rehearsal</span> : null}
            {config?.contract_configured ? (
              <span className="chip">{config.chain}</span>
            ) : null}
            <WalletMenu />
          </div>
        </div>
        <nav className="nav-mobile" aria-label="Primary mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {unconfigured ? (
        <div className="banner">
          <div className="banner-inner">
            <strong>Contract not configured.</strong> PUBLIC_CONTRACT_ADDRESS is empty. Filings,
            challenges, and resolutions run against the local rehearsal registry — not GenLayer
            Studio. After deploy, set the address and this banner disappears.
          </div>
        </div>
      ) : null}
      {wrongNetwork ? (
        <div className="banner banner-warn">
          <div className="banner-inner">
            <strong>Wrong network.</strong> Your wallet is not on the GenLayer chain this
            registry expects ({config?.chain}).{" "}
            <button type="button" className="banner-action" onClick={() => void switchNetwork()}>
              Switch network
            </button>
          </div>
        </div>
      ) : null}
      <main className="shell-main">{children}</main>
      <footer className="shell-footer">
        <div className="footer-grid">
          <div>
            <p className="brand-name">Forge Layer</p>
            <p className="muted" style={{ marginTop: "0.75rem", maxWidth: "22rem" }}>
              A public authenticity docket on GenLayer. Claims are staked, contested, inspected, and
              written into a citable record.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div>
              <p className="kicker">Product</p>
              <Link href="/registry/">Registry</Link>
              <Link href="/submit/">File a dispute</Link>
              <Link href="/protocol/">Protocol</Link>
              <Link href="/roadmap/">Roadmap</Link>
              <Link href="/security/">Security</Link>
            </div>
            <div>
              <p className="kicker">Operators</p>
              <Link href="/admin/">Admin</Link>
              <a href="https://studio.genlayer.com/" target="_blank" rel="noreferrer">
                GenLayer Studio
              </a>
              <a href="https://docs.genlayer.com/" target="_blank" rel="noreferrer">
                Documentation
              </a>
            </div>
          </div>
        </div>
        <div className="shell-footer-inner">
          <p>Forge Layer — a public authenticity docket on GenLayer.</p>
          <p className="mono">GEN · Intelligent Contracts · Equivalence Principle</p>
        </div>
      </footer>
    </div>
  );
}
