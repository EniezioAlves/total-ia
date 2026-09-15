import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { downloadSpendExport, getSpendSeries, getSpendSummary, listTeams } from "../../api/gateway";
import { networkErrorMessage } from "../../api/errors";
import type { SpendTeamRow } from "../../api/types";

function monthValue(offset: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function usd(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function tokens(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}

function deltaPct(current: string, previous: string | undefined): string | null {
  const now = Number(current);
  const before = Number(previous ?? 0);
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) {
    return null;
  }
  const change = ((now - before) / before) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% vs mês anterior`;
}

function statusLabel(status: string): string {
  if (status === "ok") return "Dentro do teto";
  if (status === "warning") return "Alerta (≥80%)";
  if (status === "exceeded") return "Estourado";
  return "Sem orçamento";
}

function statusClass(status: string): string {
  if (status === "ok") return "text-navy";
  if (status === "warning") return "text-accent";
  if (status === "exceeded") return "text-danger";
  return "text-muted";
}

function BudgetBar({ row }: { row: SpendTeamRow }) {
  if (row.utilization == null) {
    return <span className="text-muted">—</span>;
  }
  const pct = Math.min(100, Math.max(0, row.utilization * 100));
  const fill =
    row.status === "exceeded" ? "bg-danger" : row.status === "warning" ? "bg-accent" : "bg-navy";
  return (
    <div className="min-w-28">
      <div className="h-2 overflow-hidden rounded-full bg-ice">
        <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted">{pct.toFixed(0)}%</div>
    </div>
  );
}

export function SpendPage() {
  const [month, setMonth] = useState(monthValue(0));
  const [team, setTeam] = useState("");
  const query = { month, team: team || undefined };

  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: listTeams });
  const summaryQuery = useQuery({
    queryKey: ["spend-summary", month, team],
    queryFn: () => getSpendSummary(query),
  });
  const seriesQuery = useQuery({
    queryKey: ["spend-series", month, team],
    queryFn: () => getSpendSeries(query),
  });
  const exportCsv = useMutation({
    mutationFn: () => downloadSpendExport(query),
  });

  const summary = summaryQuery.data;
  const series = seriesQuery.data?.data ?? [];
  const maxCost = useMemo(() => {
    return series.reduce((highest, point) => Math.max(highest, Number(point.cost_usd) || 0), 0);
  }, [series]);
  const change = summary
    ? deltaPct(summary.totals.cost_usd, summary.previous_totals?.cost_usd)
    : null;

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Custos</h1>
          <p className="mt-2 text-sm text-muted">
            Consumo e valor por equipe no mês (horário de Fortaleza). A limpeza de auditoria não
            apaga este saldo.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50"
          disabled={exportCsv.isPending}
          onClick={() => exportCsv.mutate()}
        >
          Exportar CSV
        </button>
      </div>

      <form className="mt-6 flex flex-wrap gap-3 rounded-xl border border-line bg-white p-4">
        <label className="text-sm">
          Período
          <select
            className="mt-1 block rounded-lg border border-line px-3 py-2"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            <option value={monthValue(0)}>Este mês ({monthValue(0)})</option>
            <option value={monthValue(-1)}>Mês anterior ({monthValue(-1)})</option>
          </select>
        </label>
        <label className="text-sm">
          Equipe
          <select
            className="mt-1 block min-w-48 rounded-lg border border-line px-3 py-2"
            value={team}
            onChange={(event) => setTeam(event.target.value)}
          >
            <option value="">Todas</option>
            {(teamsQuery.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
              </option>
            ))}
          </select>
        </label>
      </form>

      {summaryQuery.isError ? (
        <p className="mt-4 text-sm text-danger">{networkErrorMessage(summaryQuery.error)}</p>
      ) : null}
      {exportCsv.isError ? (
        <p className="mt-4 text-sm text-danger">{networkErrorMessage(exportCsv.error)}</p>
      ) : null}

      {summary && summary.totals.unknown_cost_hops > 0 ? (
        <p className="mt-4 rounded-lg border border-accent/40 bg-white px-4 py-3 text-sm text-navy">
          {summary.totals.unknown_cost_hops} hop(s) sem custo do LiteLLM — o USD pode estar
          incompleto. Tokens desses hops entram na contagem.
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-sm text-muted">Gasto no período</div>
          <div className="mt-1 text-2xl font-semibold text-navy">
            {usd(summary?.totals.cost_usd)}
          </div>
          {change ? <div className="mt-1 text-[11px] text-muted">{change}</div> : null}
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-sm text-muted">Tokens</div>
          <div className="mt-1 text-2xl font-semibold text-navy">
            {tokens(summary?.totals.total_tokens)}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            prompt {tokens(summary?.totals.prompt_tokens)} · completion{" "}
            {tokens(summary?.totals.completion_tokens)}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-sm text-muted">Hops faturáveis</div>
          <div className="mt-1 text-2xl font-semibold text-navy">{tokens(summary?.totals.hops)}</div>
          <div className="mt-1 text-[11px] text-muted">cada chamada ao engine conta uma vez</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-sm text-muted">Mês anterior</div>
          <div className="mt-1 text-2xl font-semibold text-navy">
            {usd(summary?.previous_totals?.cost_usd)}
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-line bg-white p-4">
        <h2 className="text-sm font-medium text-navy">Série diária (USD)</h2>
        {seriesQuery.isError ? (
          <p className="mt-2 text-sm text-danger">{networkErrorMessage(seriesQuery.error)}</p>
        ) : null}
        <div className="mt-4 flex h-36 items-end gap-1">
          {series.map((point) => {
            const value = Number(point.cost_usd) || 0;
            const height = maxCost > 0 ? Math.max(4, (value / maxCost) * 100) : 4;
            return (
              <div key={point.day} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                <div
                  className="w-full max-w-3 rounded-t bg-navy/80"
                  style={{ height: `${height}%` }}
                  title={`${point.day}: ${usd(point.cost_usd)} · ${tokens(point.total_tokens)} tokens`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{series[0]?.day}</span>
          <span>{series[series.length - 1]?.day}</span>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy">Por equipe</h2>
        <div className="mt-3 overflow-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-ice text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Equipe</th>
                <th className="px-4 py-3 font-medium">Gasto</th>
                <th className="px-4 py-3 font-medium">Orçamento</th>
                <th className="px-4 py-3 font-medium">Uso</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Hops</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.by_team ?? []).map((row) => (
                <tr key={row.gateway_team} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-navy hover:underline" to={`/admin/teams/${row.gateway_team}`}>
                      {row.gateway_team}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{usd(row.cost_usd)}</td>
                  <td className="px-4 py-3">
                    {row.monthly_budget_usd != null ? usd(row.monthly_budget_usd) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <BudgetBar row={row} />
                  </td>
                  <td className={`px-4 py-3 ${statusClass(row.status)}`}>{statusLabel(row.status)}</td>
                  <td className="px-4 py-3">{tokens(row.total_tokens)}</td>
                  <td className="px-4 py-3">{tokens(row.hops)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy">Por pessoa</h2>
        <div className="mt-3 overflow-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-ice text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Pessoa</th>
                <th className="px-4 py-3 font-medium">Equipe</th>
                <th className="px-4 py-3 font-medium">Gasto</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Hops</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.by_user ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={5}>
                    Ainda não há hops faturáveis neste período.
                  </td>
                </tr>
              ) : (
                (summary?.by_user ?? []).map((row) => (
                  <tr key={`${row.user_oid || row.client_id}-${row.gateway_team}`} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy">
                        {row.display_name || row.user_oid || row.client_id || "—"}
                      </div>
                      <div className="text-[11px] text-muted">
                        {row.email || row.user_oid || row.client_id}
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.gateway_team}</td>
                    <td className="px-4 py-3">{usd(row.cost_usd)}</td>
                    <td className="px-4 py-3">{tokens(row.total_tokens)}</td>
                    <td className="px-4 py-3">{tokens(row.hops)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-navy">Por modelo</h2>
        <div className="mt-3 overflow-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-ice text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Modelo</th>
                <th className="px-4 py-3 font-medium">Gasto</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Hops</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.by_model ?? []).map((row) => (
                <tr key={row.model} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-navy">{row.model}</td>
                  <td className="px-4 py-3">{usd(row.cost_usd)}</td>
                  <td className="px-4 py-3">{tokens(row.total_tokens)}</td>
                  <td className="px-4 py-3">{tokens(row.hops)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
