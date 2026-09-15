import { asError } from "./errors";
import { expectOk, gatewayFetch, readJson } from "./client";
import type {
  AuditList,
  ChatMessage,
  DenylistEntry,
  HealthReady,
  Mapping,
  MappingCreate,
  MappingSessionLabels,
  ModelItem,
  RunStreamEvent,
  SpendSeries,
  SpendSummary,
  Team,
  TeamCreate,
  TeamUpdate,
  ThreadItem,
  ToolItem,
} from "./types";

function idsFromList(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("data" in body)) {
    return [];
  }
  const data = (body as { data: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) =>
      item && typeof item === "object" && "id" in item && typeof item.id === "string"
        ? item.id
        : null,
    )
    .filter((id): id is string => Boolean(id));
}

export async function listModels(): Promise<string[]> {
  const { response, requestId } = await gatewayFetch("/v1/models");
  const body = await expectOk(response, requestId);
  return idsFromList(body);
}

export async function listAgentTools(): Promise<ToolItem[]> {
  const { response, requestId } = await gatewayFetch("/v1/agent/tools");
  const body = await expectOk(response, requestId);
  if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data)) {
    return [];
  }
  return body.data.filter(
    (item): item is ToolItem =>
      Boolean(item) && typeof item === "object" && typeof (item as ToolItem).id === "string",
  );
}

export async function listThreads(): Promise<ThreadItem[]> {
  const { response, requestId } = await gatewayFetch("/v1/threads");
  const body = await expectOk(response, requestId);
  if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data)) {
    return [];
  }
  return body.data.filter(
    (item): item is ThreadItem =>
      Boolean(item) && typeof item === "object" && typeof (item as ThreadItem).id === "string",
  );
}

export async function createThread(): Promise<ThreadItem> {
  const { response, requestId } = await gatewayFetch("/v1/threads", { method: "POST" });
  const body = await expectOk(response, requestId);
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") {
    throw asError(502, { detail: { message: "Resposta inesperada ao criar conversa." } }, requestId);
  }
  return body as ThreadItem;
}

export async function deleteThread(threadId: string): Promise<void> {
  const { response, requestId } = await gatewayFetch(`/v1/threads/${threadId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    throw asError(response.status, await readJson(response), requestId);
  }
}

export async function listMessages(threadId: string): Promise<ChatMessage[]> {
  const { response, requestId } = await gatewayFetch(`/v1/threads/${threadId}/messages`);
  const body = await expectOk(response, requestId);
  if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data)) {
    return [];
  }
  const messages: ChatMessage[] = [];
  for (const item of body.data) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as { id?: unknown; role?: unknown; content?: unknown };
    if (rec.role !== "user" && rec.role !== "assistant" && rec.role !== "system") {
      continue;
    }
    messages.push({
      id: typeof rec.id === "string" ? rec.id : undefined,
      role: rec.role,
      content: typeof rec.content === "string" ? rec.content : "",
    });
  }
  return messages;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!dataLines.length) {
    return null;
  }
  return { event, data: dataLines.join("\n") };
}

export async function* streamRun(
  threadId: string,
  message: string,
  model?: string,
  signal?: AbortSignal,
): AsyncGenerator<RunStreamEvent, void, unknown> {
  const { response, requestId } = await gatewayFetch(`/v1/threads/${threadId}/runs`, {
    method: "POST",
    body: JSON.stringify({
      message,
      model: model || undefined,
      stream: true,
    }),
    signal,
  });
  if (!response.ok) {
    throw asError(response.status, await readJson(response), requestId);
  }
  if (!response.body) {
    throw asError(502, { detail: { message: "Streaming indisponível." } }, requestId);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const emit = function* (block: string): Generator<RunStreamEvent, void, unknown> {
    const parsed = parseSseBlock(block.trim());
    if (!parsed) {
      return;
    }
    let data: unknown = {};
    try {
      data = JSON.parse(parsed.data) as unknown;
    } catch {
      data = { content: parsed.data };
    }
    yield { type: parsed.event, data } as RunStreamEvent;
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      yield* emit(part);
    }
  }
  if (buffer.trim()) {
    yield* emit(buffer);
  }
}

export async function getHealth(): Promise<HealthReady> {
  const { response, requestId } = await gatewayFetch("/health/ready");
  const body = await readJson(response);
  if (!body || typeof body !== "object") {
    throw asError(response.status || 502, body, requestId);
  }
  return body as HealthReady;
}

export async function listTeams(): Promise<Team[]> {
  const { response, requestId } = await gatewayFetch("/api/admin/teams", {}, { admin: true });
  const body = await expectOk(response, requestId);
  return Array.isArray(body) ? (body as Team[]) : [];
}

export async function getTeam(id: string): Promise<Team> {
  const { response, requestId } = await gatewayFetch(`/api/admin/teams/${id}`, {}, { admin: true });
  return (await expectOk(response, requestId)) as Team;
}

export async function createTeam(payload: TeamCreate): Promise<Team> {
  const { response, requestId } = await gatewayFetch(
    "/api/admin/teams",
    { method: "POST", body: JSON.stringify(payload) },
    { admin: true },
  );
  return (await expectOk(response, requestId)) as Team;
}

export async function rotateTeamSecret(id: string): Promise<{
  object: string;
  secret_ref: string;
  recovered: boolean;
  previous_revoked: boolean;
  env_override: boolean;
}> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/teams/${id}/secret/rotate`,
    { method: "POST" },
    { admin: true },
  );
  return (await expectOk(response, requestId)) as {
    object: string;
    secret_ref: string;
    recovered: boolean;
    previous_revoked: boolean;
    env_override: boolean;
  };
}

export async function updateTeam(id: string, payload: TeamUpdate): Promise<Team> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/teams/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    { admin: true },
  );
  return (await expectOk(response, requestId)) as Team;
}

export async function listMappings(teamId: string): Promise<Mapping[]> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/teams/${teamId}/mappings`,
    {},
    { admin: true },
  );
  const body = await expectOk(response, requestId);
  return Array.isArray(body) ? (body as Mapping[]) : [];
}

export async function createMapping(teamId: string, payload: MappingCreate): Promise<Mapping> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/teams/${teamId}/mappings`,
    { method: "POST", body: JSON.stringify(payload) },
    { admin: true },
  );
  return (await expectOk(response, requestId)) as Mapping;
}

export async function refreshMapping(
  teamId: string,
  mappingId: number,
  payload?: MappingSessionLabels,
): Promise<Mapping> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/teams/${teamId}/mappings/${mappingId}/refresh`,
    {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined,
    },
    { admin: true },
  );
  return (await expectOk(response, requestId)) as Mapping;
}

export async function deleteMapping(teamId: string, mappingId: number): Promise<void> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/teams/${teamId}/mappings/${mappingId}`,
    { method: "DELETE" },
    { admin: true },
  );
  if (!response.ok && response.status !== 204) {
    throw asError(response.status, await readJson(response), requestId);
  }
}

export async function listDenylist(): Promise<DenylistEntry[]> {
  const { response, requestId } = await gatewayFetch("/api/admin/denylist", {}, { admin: true });
  const body = await expectOk(response, requestId);
  return Array.isArray(body) ? (body as DenylistEntry[]) : [];
}

export async function createDenylist(payload: {
  principal_type: "user_oid" | "app_azp";
  principal_id: string;
  reason: string;
  expires_at?: string;
}): Promise<DenylistEntry> {
  const { response, requestId } = await gatewayFetch(
    "/api/admin/denylist",
    { method: "POST", body: JSON.stringify(payload) },
    { admin: true },
  );
  return (await expectOk(response, requestId)) as DenylistEntry;
}

export async function deleteDenylist(id: number): Promise<void> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/denylist/${id}`,
    { method: "DELETE" },
    { admin: true },
  );
  if (!response.ok && response.status !== 204) {
    throw asError(response.status, await readJson(response), requestId);
  }
}

export async function listAudit(params: {
  team?: string;
  oid?: string;
  reason_code?: string;
  decision?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditList> {
  const query = new URLSearchParams();
  if (params.team) query.set("team", params.team);
  if (params.oid) query.set("oid", params.oid);
  if (params.reason_code) query.set("reason_code", params.reason_code);
  if (params.decision) query.set("decision", params.decision);
  query.set("limit", String(params.limit ?? 50));
  query.set("offset", String(params.offset ?? 0));
  const { response, requestId } = await gatewayFetch(
    `/api/admin/audit?${query.toString()}`,
    {},
    { admin: true },
  );
  return (await expectOk(response, requestId)) as AuditList;
}

export async function purgeAudit(): Promise<{ retention_days: number; deleted: number }> {
  const { response, requestId } = await gatewayFetch(
    "/api/admin/audit/purge",
    { method: "POST" },
    { admin: true },
  );
  return (await expectOk(response, requestId)) as { retention_days: number; deleted: number };
}

export type SpendQuery = {
  month?: string;
  from?: string;
  to?: string;
  team?: string;
};

function spendQuery(params: SpendQuery): string {
  const query = new URLSearchParams();
  if (params.month) query.set("month", params.month);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.team) query.set("team", params.team);
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export async function getSpendSummary(params: SpendQuery = {}): Promise<SpendSummary> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/spend/summary${spendQuery(params)}`,
    {},
    { admin: true },
  );
  return (await expectOk(response, requestId)) as SpendSummary;
}

export async function getSpendSeries(params: SpendQuery = {}): Promise<SpendSeries> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/spend/series${spendQuery(params)}`,
    {},
    { admin: true },
  );
  return (await expectOk(response, requestId)) as SpendSeries;
}

export async function downloadSpendExport(params: SpendQuery = {}): Promise<void> {
  const { response, requestId } = await gatewayFetch(
    `/api/admin/spend/export${spendQuery(params)}`,
    {},
    { admin: true },
  );
  if (!response.ok) {
    throw asError(response.status, await readJson(response), requestId);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = params.month || params.from || "periodo";
  link.href = url;
  link.download = `spend-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type { ModelItem };
