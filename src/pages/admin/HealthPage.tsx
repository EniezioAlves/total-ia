import { useQuery } from "@tanstack/react-query";

import { getHealth } from "../../api/gateway";
import { healthCheckLabel, networkErrorMessage } from "../../api/errors";

export function HealthPage() {
  const query = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const checks = query.data?.checks ?? {};

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold text-navy">Saúde da plataforma</h1>
      <p className="mt-2 text-sm text-muted">
        Dependências da plataforma. Gráficos detalhados ficam no Grafana.
      </p>
      {query.isError ? (
        <p className="mt-4 text-sm text-danger">{networkErrorMessage(query.error)}</p>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Object.entries(checks).map(([name, ok]) => (
          <div key={name} className="rounded-xl border border-line bg-white p-4">
            <div className="text-sm text-muted">{healthCheckLabel(name)}</div>
            <div className={`mt-1 text-lg font-semibold ${ok ? "text-navy" : "text-danger"}`}>
              {ok ? "Operando" : "Indisponível"}
            </div>
          </div>
        ))}
      </div>
      {query.data ? (
        <p className="mt-4 text-sm text-muted">
          Situação geral: {query.data.status === "ok" ? "operando" : query.data.status}
        </p>
      ) : null}
    </div>
  );
}
