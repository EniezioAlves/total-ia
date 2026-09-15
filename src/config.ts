function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error(`Defina ${name} no arquivo .env (copie de .env.example).`);
  }
  return trimmed;
}

export const config = {
  tenantId: required("VITE_ENTRA_TENANT_ID", import.meta.env.VITE_ENTRA_TENANT_ID),
  clientId: required("VITE_ENTRA_CLIENT_ID", import.meta.env.VITE_ENTRA_CLIENT_ID),
  audience: required("VITE_ENTRA_AUDIENCE", import.meta.env.VITE_ENTRA_AUDIENCE).replace(
    /\/$/,
    "",
  ),
  gatewayUrl: (import.meta.env.VITE_GATEWAY_URL ?? "").trim().replace(/\/$/, ""),
};

export const invokeScope = `${config.audience}/ai.invoke`;
