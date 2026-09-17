import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  createMapping,
  createTeam,
  deleteMapping,
  getSpendSummary,
  getTeam,
  listMappings,
  refreshMapping,
  rotateTeamSecret,
  updateTeam,
} from "../../api/gateway";
import { networkErrorMessage } from "../../api/errors";
import type { Mapping, MappingSessionLabels, Team } from "../../api/types";
import { useSession, type Session } from "../../auth/useSession";

function csv(values: string[]): string {
  return values.join(", ");
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function PolicyForm({
  team,
  creating,
}: {
  team?: Team;
  creating: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [id, setId] = useState(team?.id ?? "");
  const [litellmTeam, setLitellmTeam] = useState(team?.litellm_team ?? "");
  const [models, setModels] = useState(csv(team?.models ?? ["gpt-4o-mini"]));
  const [tools, setTools] = useState(csv(team?.tools ?? []));
  const [rpm, setRpm] = useState(team?.rpm_limit ?? 60);
  const [maxOutput, setMaxOutput] = useState(team?.max_output_tokens ?? 4096);
  const [budget, setBudget] = useState(
    team?.monthly_budget_usd == null || team.monthly_budget_usd === ""
      ? ""
      : String(team.monthly_budget_usd),
  );
  const [enforcement, setEnforcement] = useState<"off" | "observe" | "enforce">(
    team?.budget_enforcement ?? "off",
  );
  const [pii, setPii] = useState(team?.pii_block ?? true);
  const [injection, setInjection] = useState(team?.injection_block ?? true);
  const [status, setStatus] = useState<"active" | "disabled">(
    team?.status === "disabled" ? "disabled" : "active",
  );
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (creating) {
        return createTeam({
          id,
          litellm_team: litellmTeam,
          models: parseCsv(models),
          tools: parseCsv(tools),
          rpm_limit: rpm,
          max_output_tokens: maxOutput,
          monthly_budget_usd: budget.trim() === "" ? null : Number(budget),
          budget_enforcement: enforcement,
          pii_block: pii,
          injection_block: injection,
          status,
        });
      }
      return updateTeam(team!.id, {
        models: parseCsv(models),
        tools: parseCsv(tools),
        rpm_limit: rpm,
        max_output_tokens: maxOutput,
        monthly_budget_usd: budget.trim() === "" ? null : Number(budget),
        budget_enforcement: enforcement,
        pii_block: pii,
        injection_block: injection,
        status,
      });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      await queryClient.invalidateQueries({ queryKey: ["team", saved.id] });
      navigate(`/admin/teams/${saved.id}`);
    },
    onError: (err) => setError(networkErrorMessage(err)),
  });

  return (
    <form
      className="space-y-4 rounded-xl border border-line bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          ID do team
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={id}
            disabled={!creating}
            onChange={(event) => {
              const next = event.target.value;
              const previousSuggested = `team_${id.replace(/-/g, "_")}`;
              setId(next);
              if (creating) {
                const suggested = `team_${next.replace(/-/g, "_")}`;
                setLitellmTeam((current) =>
                  current === "" || current === previousSuggested ? suggested : current,
                );
              }
            }}
            required
          />
        </label>
        <label className="text-sm">
          Team LiteLLM
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={litellmTeam}
            disabled={!creating}
            onChange={(event) => setLitellmTeam(event.target.value)}
            required
          />
        </label>
        {creating ? (
          <p className="sm:col-span-2 text-sm text-muted">
            A virtual key dos modelos é criada automaticamente. Não é preciso colar chave neste
            formulário.
          </p>
        ) : (
          <p className="sm:col-span-2 text-sm text-muted">
            {team?.secret_configured
              ? "A chave dos modelos está no servidor. O valor nunca aparece nesta tela."
              : "Falta a chave dos modelos — o chat desta equipe falha até renovar."}{" "}
            Referência interna: <code>{team?.litellm_key_secret_ref}</code>
          </p>
        )}
        <label className="text-sm sm:col-span-2">
          Modelos permitidos
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={models}
            onChange={(event) => setModels(event.target.value)}
            required
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Ferramentas permitidas
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={tools}
            onChange={(event) => setTools(event.target.value)}
            placeholder="consultar_estoque, buscar_documentos"
          />
        </label>
        <label className="text-sm">
          RPM
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={rpm}
            onChange={(event) => setRpm(Number(event.target.value))}
          />
        </label>
        <label className="text-sm">
          Limite de respostas (tokens)
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={maxOutput}
            onChange={(event) => setMaxOutput(Number(event.target.value))}
          />
        </label>
        <label className="text-sm">
          Orçamento mensal (USD)
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder="vazio = sem teto"
          />
        </label>
        <label className="text-sm">
          Teto de custo
          <select
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={enforcement}
            onChange={(event) =>
              setEnforcement(event.target.value as "off" | "observe" | "enforce")
            }
          >
            <option value="off">Desligado (só acompanhar)</option>
            <option value="observe">Observar (não corta)</option>
            <option value="enforce">Cortar ao estourar</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={pii} onChange={(event) => setPii(event.target.checked)} />
          Bloquear PII
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={injection}
            onChange={(event) => setInjection(event.target.checked)}
          />
          Bloquear injeção
        </label>
        <label className="flex items-center gap-2">
          Status
          <select
            className="rounded-lg border border-line px-2 py-1"
            value={status}
            onChange={(event) => setStatus(event.target.value as "active" | "disabled")}
          >
            <option value="active">Ativa</option>
            <option value="disabled">Desativada</option>
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={save.isPending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {creating ? "Criar equipe" : "Salvar política"}
      </button>
    </form>
  );
}

function sessionLabels(session: Session): MappingSessionLabels {
  const labels: MappingSessionLabels = {};
  if (session.name) labels.display_name = session.name;
  if (session.email) labels.email = session.email;
  return labels;
}

function isSelfMapping(row: Mapping, session: Session): boolean {
  return row.entra_type === "user_oid" && row.entra_id === session.oid;
}

function MappingRow({
  teamId,
  row,
  session,
  onError,
}: {
  teamId: string;
  row: Mapping;
  session: Session;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const mine = isSelfMapping(row, session);
  const refresh = useMutation({
    mutationFn: () => refreshMapping(teamId, row.id, mine ? sessionLabels(session) : undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mappings", teamId] });
    },
    onError: (err) => onError(networkErrorMessage(err)),
  });
  const removeMapping = useMutation({
    mutationFn: () => deleteMapping(teamId, row.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mappings", teamId] });
    },
    onError: (err) => onError(networkErrorMessage(err)),
  });
  const displayName = row.display_name || (mine ? session.name : "") || "Nome indisponível no Entra";
  const displayEmail = row.email || (mine ? session.email : "");

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-navy">{displayName}</p>
          {displayEmail ? <p className="text-muted">{displayEmail}</p> : null}
          <p className="mt-0.5 font-mono text-xs text-muted">
            {row.entra_type} · {row.entra_id}
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            className="text-navy"
            onClick={() => {
              onError("");
              refresh.mutate();
            }}
            disabled={refresh.isPending}
          >
            Atualizar do Entra
          </button>
          <button
            type="button"
            className="text-danger"
            onClick={() => removeMapping.mutate()}
            disabled={removeMapping.isPending}
          >
            Remover
          </button>
        </div>
      </div>
    </li>
  );
}

function SecretRotatePanel({ team }: { team: Team }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const rotate = useMutation({
    mutationFn: () => rotateTeamSecret(team.id),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["team", team.id] });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      const parts = [
        result.recovered
          ? "Chave recriada. O chat desta equipe volta a autenticar no engine."
          : "Chave renovada. A virtual key anterior foi substituída no volume.",
      ];
      if (result.env_override) {
        parts.push(
          `Remova ${result.secret_ref} do .env; senão o próximo recreate do container volta a chave antiga.`,
        );
      }
      setMessage(parts.join(" "));
      setError("");
    },
    onError: (err) => {
      setMessage("");
      setError(networkErrorMessage(err));
    },
  });

  return (
    <section className="mt-4 rounded-xl border border-line bg-white p-6">
      <h2 className="text-lg font-semibold text-navy">Chave do engine</h2>
      <p className="mt-1 text-sm text-muted">
        Gera uma virtual key nova no LiteLLM e grava no volume do Gateway. Use se o volume se
        perder ou para rotacionar. O valor da chave não aparece nesta tela.
      </p>
      {team.secret_configured === false ? (
        <p className="mt-3 text-sm text-danger">Chave ausente neste Gateway. Renove para restaurar o chat.</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-navy">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        className="mt-4 rounded-lg border border-line px-4 py-2 text-sm font-medium text-navy hover:bg-ice disabled:opacity-50"
        disabled={rotate.isPending}
        onClick={() => {
          if (
            window.confirm(
              "Gerar uma chave nova no LiteLLM e substituir a deste volume? O browser não vê o valor.",
            )
          ) {
            rotate.mutate();
          }
        }}
      >
        {rotate.isPending ? "Renovando…" : "Renovar chave"}
      </button>
    </section>
  );
}

export function TeamDetailPage() {
  const { teamId } = useParams();
  const creating = teamId === "new";
  const session = useSession(true);
  const queryClient = useQueryClient();
  const teamQuery = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => getTeam(teamId!),
    enabled: Boolean(teamId) && !creating,
  });
  const mappingsQuery = useQuery({
    queryKey: ["mappings", teamId],
    queryFn: () => listMappings(teamId!),
    enabled: Boolean(teamId) && !creating,
  });
  const spendQuery = useQuery({
    queryKey: ["spend-summary", "team", teamId],
    queryFn: () => getSpendSummary({ team: teamId }),
    enabled: Boolean(teamId) && !creating,
  });
  const spendRow = spendQuery.data?.by_team.find((row) => row.gateway_team === teamId);
  const [entraType, setEntraType] = useState("user_oid");
  const [entraId, setEntraId] = useState("");
  const [mapError, setMapError] = useState("");

  const addMapping = useMutation({
    mutationFn: () => {
      const oid = entraId.trim();
      const mine = entraType === "user_oid" && oid === session.oid;
      return createMapping(teamId!, {
        entra_type: entraType,
        entra_id: oid,
        ...(mine ? sessionLabels(session) : {}),
      });
    },
    onSuccess: async () => {
      setEntraId("");
      await queryClient.invalidateQueries({ queryKey: ["mappings", teamId] });
    },
    onError: (err) => setMapError(networkErrorMessage(err)),
  });

  useEffect(() => {
    if (!teamId || creating || !session.oid) {
      return;
    }
    const mine = (mappingsQuery.data ?? []).find(
      (row) => isSelfMapping(row, session) && !row.display_name,
    );
    if (!mine) {
      return;
    }
    void refreshMapping(teamId, mine.id, sessionLabels(session)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["mappings", teamId] }),
    );
  }, [
    creating,
    mappingsQuery.data,
    queryClient,
    session.email,
    session.name,
    session.oid,
    teamId,
  ]);

  const title = useMemo(
    () => (creating ? "Nova equipe" : teamQuery.data?.id || teamId),
    [creating, teamId, teamQuery.data?.id],
  );

  return (
    <div className="mx-auto max-w-4xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-8">
      <Link to="/admin/teams" className="text-sm text-muted hover:text-navy">
        ← Equipes
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-navy">{title}</h1>
      {teamQuery.isError ? (
        <p className="mt-4 text-sm text-danger">{networkErrorMessage(teamQuery.error)}</p>
      ) : null}
      {(creating || teamQuery.data) && (
        <div className="mt-6">
          {!creating && spendRow ? (
            <div className="mb-4 rounded-xl border border-line bg-white p-4 text-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-muted">Gasto neste mês</div>
                  <div className="mt-1 text-lg font-semibold text-navy">
                    ${Number(spendRow.cost_usd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </div>
                </div>
                <div className="text-muted">
                  {spendRow.monthly_budget_usd != null
                    ? `Teto ${spendRow.monthly_budget_usd} USD · ${
                        spendRow.utilization != null
                          ? `${Math.round(spendRow.utilization * 100)}%`
                          : "—"
                      }`
                    : "Sem orçamento definido"}
                </div>
                <Link className="text-navy hover:underline" to="/admin/spend">
                  Ver Custos
                </Link>
              </div>
            </div>
          ) : null}
          <PolicyForm creating={creating} team={teamQuery.data} key={teamQuery.data?.id || "new"} />
          {!creating && teamQuery.data ? <SecretRotatePanel team={teamQuery.data} /> : null}
        </div>
      )}
      {!creating && teamQuery.data ? (
        <section className="mt-8 rounded-xl border border-line bg-white p-6">
          <h2 className="text-lg font-semibold text-navy">Mappings Entra</h2>
          <p className="mt-1 text-sm text-muted">
            O nome ao lado do menu é a sessão Entra (login). No mapping ele grava quando o oid é o
            seu, ou quando o Graph resolve outra pessoa. O chat não consulta Graph.
          </p>
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setMapError("");
              addMapping.mutate();
            }}
          >
            <select
              className="rounded-lg border border-line px-2 py-2 text-sm"
              value={entraType}
              onChange={(event) => setEntraType(event.target.value)}
            >
              <option value="user_oid">user_oid</option>
              <option value="app_azp">app_azp</option>
              <option value="group">group</option>
            </select>
            <input
              className="min-w-56 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
              placeholder={session.oid || "oid, azp ou group id"}
              value={entraId}
              onChange={(event) => setEntraId(event.target.value)}
              required
            />
            {session.oid ? (
              <button
                type="button"
                className="rounded-lg border border-line px-3 py-2 text-sm text-navy"
                onClick={() => {
                  setEntraType("user_oid");
                  setEntraId(session.oid);
                }}
              >
                Usar meu oid
              </button>
            ) : null}
            <button
              type="submit"
              className="rounded-lg bg-navy px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={addMapping.isPending}
            >
              Adicionar
            </button>
          </form>
          {mapError ? <p className="mt-2 text-sm text-danger">{mapError}</p> : null}
          <ul className="mt-4 divide-y divide-line text-sm">
            {(mappingsQuery.data ?? []).map((row) => (
              <MappingRow
                key={row.id}
                teamId={teamId!}
                row={row}
                session={session}
                onError={setMapError}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
