import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { listTeams } from "../../api/gateway";
import { networkErrorMessage } from "../../api/errors";

export function TeamsPage() {
  const query = useQuery({ queryKey: ["teams"], queryFn: listTeams });
  const teams = query.data ?? [];

  return (
    <div className="mx-auto max-w-5xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Equipes</h1>
          <p className="mt-2 text-sm text-muted">
            Política de modelos, ferramentas, limites e orçamento mensal.
          </p>
        </div>
        <Link
          to="/admin/teams/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Nova equipe
        </Link>
      </div>
      {query.isError ? (
        <p className="mt-4 text-sm text-danger">{networkErrorMessage(query.error)}</p>
      ) : null}
      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ice text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Modelos</th>
              <th className="px-4 py-3 font-medium">Ferramentas</th>
              <th className="px-4 py-3 font-medium">RPM</th>
              <th className="px-4 py-3 font-medium">Orçamento / mês</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link className="font-medium text-navy hover:underline" to={`/admin/teams/${team.id}`}>
                    {team.id}
                  </Link>
                  <div className="text-[11px] text-muted">
                    {team.secret_configured === false
                      ? "sem acesso aos modelos — abra a equipe e renove a chave"
                      : "acesso aos modelos configurado"}
                  </div>
                </td>
                <td className="px-4 py-3">{team.status === "disabled" ? "desativada" : "ativa"}</td>
                <td className="px-4 py-3">{team.models.join(", ") || "—"}</td>
                <td className="px-4 py-3">{team.tools.join(", ") || "—"}</td>
                <td className="px-4 py-3">{team.rpm_limit}</td>
                <td className="px-4 py-3">
                  {team.monthly_budget_usd == null || team.monthly_budget_usd === ""
                    ? "—"
                    : `$${Number(team.monthly_budget_usd).toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
