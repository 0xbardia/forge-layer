"use client";

import { useMemo, useState } from "react";
import { DisputeCard } from "@/components/DisputeCard";
import { BtnLink, Button, Input, Panel } from "@/components/ui";
import { loadDisputes, loadStats } from "@/lib/actions";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/hooks";
import { STATUSES, weiToGen } from "@/lib/protocol";

export default function RegistryPage() {
  const { config } = useSession();
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const limit = 9;

  const stats = useAsync(() => loadStats(config), [config?.contract_configured]);
  const list = useAsync(
    () =>
      loadDisputes(config, {
        status: status || undefined,
        content_type: kind || undefined,
        q: q || undefined,
        offset: page * limit,
        limit,
      }),
    [status, kind, q, page, config?.contract_configured],
  );

  const pages = useMemo(
    () => Math.max(1, Math.ceil((list.data?.total ?? 0) / limit)),
    [list.data?.total],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Public record</p>
          <h1 className="display">Registry</h1>
        </div>
        <BtnLink href="/submit/">File a dispute</BtnLink>
      </div>

      <div className="meta-row">
        <div>
          <p>Dockets</p>
          <p>{stats.data ? String(stats.data.total) : "—"}</p>
        </div>
        <div>
          <p>Open</p>
          <p>{stats.data ? String(stats.data.open) : "—"}</p>
        </div>
        <div>
          <p>In contest</p>
          <p>{stats.data ? String(stats.data.challenged) : "—"}</p>
        </div>
        <div>
          <p>Value staked</p>
          <p>{stats.data ? `${weiToGen(stats.data.total_staked)} GEN` : "—"}</p>
        </div>
      </div>

      <div className="toolbar">
        <Input
          placeholder="Search docket, address, or excerpt"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          aria-label="Search dockets"
        />
        <div className="chip-row">
          <button
            type="button"
            className={`filter-chip${status === "" ? " is-on" : ""}`}
            onClick={() => {
              setStatus("");
              setPage(0);
            }}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`filter-chip${status === s ? " is-on" : ""}`}
              onClick={() => {
                setStatus(s);
                setPage(0);
              }}
            >
              {s.replace("_", " ")}
            </button>
          ))}
          <button
            type="button"
            className={`filter-chip${kind === "image" ? " is-on" : ""}`}
            onClick={() => {
              setKind(kind === "image" ? "" : "image");
              setPage(0);
            }}
          >
            Image
          </button>
          <button
            type="button"
            className={`filter-chip${kind === "text" ? " is-on" : ""}`}
            onClick={() => {
              setKind(kind === "text" ? "" : "text");
              setPage(0);
            }}
          >
            Text
          </button>
        </div>
      </div>

      {list.loading ? (
        <div className="card-grid" style={{ marginTop: "2rem" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Panel key={i} className="skeleton" />
          ))}
        </div>
      ) : list.error ? (
        <Panel className="error-box">
          <h2>Unable to load the registry</h2>
          <p>{list.error}</p>
        </Panel>
      ) : !list.data?.items.length ? (
        <Panel className="empty">
          <h2>No dockets match.</h2>
          <p>Adjust filters, or file the first dispute in this slice of the registry.</p>
        </Panel>
      ) : (
        <div className="card-grid" style={{ marginTop: "2rem" }}>
          {list.data.items.map((d) => (
            <DisputeCard key={d.id} dispute={d} />
          ))}
        </div>
      )}

      <div className="pager">
        <span>
          Page {page + 1} of {pages}
        </span>
        <div className="pager-btns">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
