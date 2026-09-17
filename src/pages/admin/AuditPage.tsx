import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { listAudit, purgeAudit } from "../../api/gateway";
import { networkErrorMessage } from "../../api/errors";

export function AuditPage() {
  const [team, setTeam] = useState("");
  const [oid, setOid] = useState("");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const query = useQuery({
    queryKey: ["audit", team, oid, reason, decision, offset],
    queryFn: () =>
      listAudit({
        team: team || undefined,
        oid: oid || undefined,
        reason_code: reason || undefined,
        decision: decision || undefined,
        limit,
        offset,
      }),
  });
  const purge = useMutation({
    mutationFn: purgeAudit,
    onSuccess: () => query.refetch(),
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Auditoria</h1>
          <p className="mt-2 text-sm text-muted">
            Metadados de decisão. Prompt, resposta e chaves não são armazenados.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-2 text-sm"
          onClick={() => {
            if (window.confirm("Excluir registros de auditoria fora do prazo de retenção?")) {
              purge.mutate();
            }
          }}
        >
          Limpar antigos
        </button>
      </div>
      <form
        className="mt-6 grid gap-2 rounded-xl border border-line bg-white p-4 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          void query.refetch();
        }}
      >
        <input
          className="rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="team"
          value={team}
          onChange={(event) => setTeam(event.target.value)}
        />
        <input
          className="rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="oid"
          value={oid}
          onChange={(event) => setOid(event.target.value)}
        />
        <input
          className="rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="reason_code"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <input
          className="rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="decision"
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
        />
      </form>
      {query.isError ? (
        <p className="mt-4 text-sm text-danger">{networkErrorMessage(query.error)}</p>
      ) : null}
      {purge.isError ? (
        <p className="mt-4 text-sm text-danger">{networkErrorMessage(purge.error)}</p>
      ) : null}
      <div className="mt-4 overflow-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-ice text-muted">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">request_id</th>
              <th className="px-3 py-2">team</th>
              <th className="px-3 py-2">oid</th>
              <th className="px-3 py-2">decision</th>
              <th className="px-3 py-2">reason</th>
              <th className="px-3 py-2">model</th>
              <th className="px-3 py-2">tokens</th>
              <th className="px-3 py-2">USD</th>
              <th className="px-3 py-2">tool</th>
              <th className="px-3 py-2">ms</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2">{new Date(row.timestamp).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2 font-mono">{row.request_id}</td>
                <td className="px-3 py-2">{row.gateway_team || "—"}</td>
                <td className="px-3 py-2">{row.user_oid || "—"}</td>
                <td className="px-3 py-2">{row.decision}</td>
                <td className="px-3 py-2">{row.reason_code}</td>
                <td className="px-3 py-2">{row.model || "—"}</td>
                <td className="px-3 py-2">{row.tokens ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.cost_usd == null
                    ? "—"
                    : `$${row.cost_usd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`}
                </td>
                <td className="px-3 py-2">{row.tool || "—"}</td>
                <td className="px-3 py-2">{row.latency_ms ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>
          {offset + 1}–{Math.min(offset + limit, total)} de {total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-line px-2 py-1 disabled:opacity-40"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="rounded border border-line px-2 py-1 disabled:opacity-40"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Seguinte
          </button>
        </div>
      </div>
    </div>
  );
}
