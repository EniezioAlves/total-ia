export type Capabilities = {
  invoke: boolean;
  admin: boolean;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) {
    return null;
  }
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(" ").filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function capabilitiesFromToken(token: string): Capabilities {
  const claims = decodeJwtPayload(token);
  if (!claims) {
    return { invoke: false, admin: false };
  }
  const roles = asStringList(claims.roles);
  const admin = roles.includes("gateway.admin");
  const invoke =
    admin || roles.includes("gateway.user") || roles.includes("gateway.app");
  return { invoke, admin };
}

export function audiencesOf(claims: Record<string, unknown>): string[] {
  const aud = claims.aud;
  if (typeof aud === "string") {
    return [aud];
  }
  if (Array.isArray(aud)) {
    return aud.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export { decodeJwtPayload };
