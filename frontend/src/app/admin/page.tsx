"use client";

import { useState } from "react";
import { ConfigNotice } from "@/components/ConfigNotice";
import { Button, Field, Input, Panel } from "@/components/ui";
import { adminFee, adminPause, adminTransfer, adminWithdraw, loadStats } from "@/lib/actions";
import { parseRevert } from "@/lib/chain";
import { useAsync } from "@/lib/hooks";
import { shortAddress, weiToGen } from "@/lib/protocol";
import { useSession } from "@/lib/session";

export default function AdminPage() {
  const { address, requireCaller, config } = useSession();
  const stats = useAsync(() => loadStats(config), [config?.contract_configured]);
  const [fee, setFee] = useState("250");
  const [to, setTo] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const owner = stats.data?.owner;
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  async function run<T>(fn: () => Promise<T>, ok: string) {
    setMsg(null);
    try {
      requireCaller();
      await fn();
      setMsg(ok);
      stats.reload?.();
    } catch (e) {
      setMsg(parseRevert(e));
    }
  }

  return (
    <>
      <p className="kicker">Owner</p>
      <h1 className="display">Admin</h1>
      <p className="lede">
        Pause, fee, and fee-withdrawal are owner-gated. Non-owners receive a specific revert.
      </p>
      <ConfigNotice />
      <div className="stat-row">
        <Panel>
          <p className="kicker">Owner</p>
          <p className="mono">{owner ?? "—"}</p>
        </Panel>
        <Panel>
          <p className="kicker">Paused</p>
          <p className="display">{stats.data?.paused ? "Yes" : "No"}</p>
        </Panel>
        <Panel>
          <p className="kicker">Fee vault</p>
          <p className="display">{stats.data ? `${weiToGen(stats.data.fee_balance)} GEN` : "—"}</p>
        </Panel>
      </div>
      {!isOwner ? (
        <Panel>
          <p className="muted">Connected account is not the owner. Admin writes will revert with “only owner”.</p>
        </Panel>
      ) : null}
      <div className="grid-2">
        <Panel>
          <h2>Pause</h2>
          <div className="row">
            <Button onClick={() => run(() => adminPause(config, { caller: requireCaller(), paused: true }), "Paused.")}>
              Pause
            </Button>
            <Button variant="secondary" onClick={() => run(() => adminPause(config, { caller: requireCaller(), paused: false }), "Unpaused.")}>
              Unpause
            </Button>
          </div>
        </Panel>
        <Panel>
          <h2>Fee (bps)</h2>
          <Field label="Basis points">
            <Input value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
          <Button onClick={() => run(() => adminFee(config, { caller: requireCaller(), fee_bps: Number(fee) }), "Fee updated.")}>
            Update fee
          </Button>
        </Panel>
        <Panel>
          <h2>Withdraw fees</h2>
          <Field label="Recipient">
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
          </Field>
          <Button
            onClick={() =>
              run(
                () => adminWithdraw(config, { caller: requireCaller(), to: to || requireCaller() }),
                `Withdrawn to ${shortAddress(to || address || "")}.`,
              )
            }
          >
            Withdraw
          </Button>
        </Panel>
        <Panel>
          <h2>Transfer ownership</h2>
          <p className="muted">Moves the owner key. Reverts on the zero address.</p>
          <Field label="New owner">
            <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="0x…" />
          </Field>
          <Button
            disabled={!newOwner}
            onClick={() =>
              run(
                () => adminTransfer(config, { caller: requireCaller(), new_owner: newOwner }),
                "Ownership transferred.",
              )
            }
          >
            Transfer ownership
          </Button>
        </Panel>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
    </>
  );
}
