import { getAccessToken } from "../auth/msal";
import { audiencesOf, decodeJwtPayload } from "../auth/capabilities";
import { config } from "../config";
import { asError } from "./errors";
import type { GatewayError } from "./types";

const GRAPH_AUD = "00000003-0000-0000-c000-000000000000";

function newRequestId(): string {
  return crypto.randomUUID();
}

function tokenHint(token: string): string | null {
  const claims = decodeJwtPayload(token);
  if (!claims) {
    return null;
  }
  const auds = audiencesOf(claims);
  if (auds.includes(config.clientId)) {
    return "O Entra devolveu um ID token (aud = app do front). No registro cliente: Permissões de API → API do Gateway → ai.invoke, e conceda o consentimento.";
  }
  if (auds.includes(GRAPH_AUD) || auds.some((item) => item.includes("graph.microsoft.com"))) {
    return "O token é do Microsoft Graph, não da API do Gateway. Peça o scope api://<id-da-api>/ai.invoke.";
  }
  return null;
}

export type GatewayResponse = {
  response: Response;
  requestId: string;
};

export async function gatewayFetch(
  path: string,
  init: RequestInit = {},
  _options: { admin?: boolean } = {},
): Promise<GatewayResponse> {
  const token = await getAccessToken();
  const hint = tokenHint(token);
  if (hint) {
    throw { status: 401, reasonCode: "AUTH_INVALID", message: hint } satisfies GatewayError;
  }
  const requestId =
    (init.headers &&
      typeof init.headers === "object" &&
      !Array.isArray(init.headers) &&
      "X-Request-ID" in init.headers &&
      typeof (init.headers as Record<string, string>)["X-Request-ID"] === "string" &&
      (init.headers as Record<string, string>)["X-Request-ID"]) ||
    newRequestId();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Request-ID": requestId,
  };
  if (init.body) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${config.gatewayUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  return { response, requestId };
}

export async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export async function expectOk(response: Response, requestId: string): Promise<unknown> {
  const body = await readJson(response);
  if (!response.ok) {
    throw asError(response.status, body, requestId);
  }
  return body;
}
