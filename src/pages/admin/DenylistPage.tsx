import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createDenylist, deleteDenylist, listDenylist } from "../../api/gateway";
import { networkErrorMessage } from "../../api/errors";

export function DenylistPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["denylist"], queryFn: listDenylist });
  const [principalType, setPrincipalType] = useState<"user_oid" | "app_azp">("user_oid");
  const [principalId, setPrincipalId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const add = useMutation({
    mutationFn: () =>
      createDenylist({
        principal_type: principalType,
        principal_id: principalId,
        reason,
      }),
    onSuccess: async () => {
      setPrincipalId("");
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["denylist"] });
    },
    onError: (err) => setError(networkErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: deleteDenylist,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["denylist"] });
    },
    onError: (err) => setError(networkErrorMessage(err)),
  });

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold text-navy">Bloqueios</h1>
      <p className="mt-2 text-sm text-muted">
        Identidades bloqueadas não conseguem usar o assistente.
      </p>
      <form
        className="mt-6 flex flex-wrap gap-2 rounded-xl border border-line bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          add.mutate();
        }}
      >
        <select
          className="rounded-lg border border-line px-2 py-2 text-sm"
          value={principalType}
          onChange={(event) => setPrincipalType(event.target.value as "user_oid" | "app_azp")}
        >
          <option value="user_oid">Usuário</option>
          <option value="app_azp">Aplicativo</option>
        </select>
        <input
          className="min-w-48 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="oid ou azp"
          value={principalId}
          onChange={(event) => setPrincipalId(event.target.value)}
          required
        />
        <input
          className="min-w-48 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="motivo"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          minLength={3}
        />
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm text-white">
          Bloquear
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {query.isError ? (
        <p className="mt-3 text-sm text-danger">{networkErrorMessage(query.error)}</p>
      ) : null}
      <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
        {(query.data ?? []).map((row) => (
          <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <div className="font-medium">
                {row.principal_type} · {row.principal_id}
              </div>
              <div className="text-muted">{row.reason}</div>
            </div>
            <button type="button" className="text-danger" onClick={() => remove.mutate(row.id)}>
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
