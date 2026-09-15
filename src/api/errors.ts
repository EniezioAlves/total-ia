import type { GatewayError } from "./types";

const SUPPORT: Record<string, string> = {
  AUTHZ_NO_MAPPING:
    "Sua conta ainda não está vinculada a uma equipe. Peça ao administrador para liberar o acesso.",
  AUTH_CLIENT:
    "Este aplicativo não está autorizado. Peça ao administrador para conferir o cadastro no Microsoft 365.",
  AUTHZ_SCOPE:
    "Sua conta não tem permissão para usar o assistente. Peça ao administrador para liberar o acesso.",
  AUTH_INVALID: "Sessão inválida ou expirada. Entre novamente.",
  AUTH_MISSING: "É preciso entrar com a conta da empresa para continuar.",
  AUTH_REPLAY: "Esta sessão não pôde ser reutilizada. Entre novamente.",
  AUTHZ_DENYLIST: "Sua conta está bloqueada nesta plataforma. Fale com o administrador.",
  ENGINE_AUTH:
    "O motor de modelos recusou a chave interna. Não é saldo da OpenAI: avise o administrador para conferir LITELLM_MASTER_KEY.",
  PROVIDER_QUOTA:
    "Os créditos da conta do provedor (OpenAI ou Anthropic) acabaram. Peça ao administrador para recarregar a conta.",
  RATE_LIMITED: "Muitas perguntas em pouco tempo. Espere um instante e tente de novo.",
  MODEL_NOT_ALLOWED: "Este modelo não está liberado para a sua equipe.",
  TOOL_NOT_ALLOWED: "Esta consulta não está liberada para a sua equipe.",
  TOOL_NOT_CONFIGURED: "Esta consulta ainda não está configurada no servidor.",
  TOOL_UPSTREAM: "Não foi possível concluir a consulta agora. Tente de novo em instantes.",
  PII_BLOCKED:
    "A mensagem contém dados pessoais que a política da equipe não permite enviar. Remova CPF, cartão ou similar e tente de novo.",
  INJECTION_BLOCKED: "A mensagem foi bloqueada pela política de segurança. Reformule e tente de novo.",
  ORCHESTRATOR_UNAVAILABLE: "O assistente está indisponível no momento. Tente de novo em instantes.",
  GRAPH_NOT_CONFIGURED: "O cadastro no Microsoft 365 ainda não está configurado no servidor.",
  GRAPH_PRINCIPAL_NOT_FOUND: "Esse usuário, grupo ou aplicativo não foi encontrado no Microsoft 365.",
  GRAPH_FORBIDDEN: "O servidor não tem permissão para consultar o Microsoft 365. Avise o administrador.",
  GRAPH_UNAVAILABLE: "Não foi possível ler os dados no Microsoft 365 agora. Tente de novo.",
  UPSTREAM: "O serviço de modelos está indisponível no momento. Tente de novo em instantes.",
  BUDGET_EXCEEDED:
    "O orçamento mensal da equipe acabou. O assistente fica bloqueado até o administrador aumentar o teto ou começar o próximo mês.",
  LIMIT_BODY: "A mensagem é grande demais. Envie um texto menor.",
  LIMIT_MESSAGES: "Esta conversa ficou longa demais. Comece uma nova.",
  LIMIT_PROMPT: "A pergunta é longa demais. Resuma e tente de novo.",
  LIMIT_TOKENS: "O contexto desta conversa estourou o limite. Comece uma nova conversa.",
  LIMIT_OUTPUT: "A resposta pedida é longa demais para o limite da equipe.",
  RUN_TIMEOUT: "A resposta demorou demais. Tente de novo.",
  RUN_ABANDONED: "A geração da resposta foi interrompida.",
  CLIENT_DISCONNECTED: "A conexão caiu no meio da resposta. Envie a pergunta de novo.",
  THREAD_NOT_FOUND: "Esta conversa não existe mais.",
  RUN_NOT_FOUND: "Esta resposta não foi encontrada.",
  TEAM_DISABLED: "Esta equipe está desativada. Fale com o administrador.",
  KEY_PROVISION_UNAVAILABLE: "Não foi possível gerar a chave da equipe. Avise o administrador.",
  KEY_PROVISION_FAILED: "Não foi possível gerar a chave da equipe. Avise o administrador.",
  DATABASE_UNAVAILABLE: "O banco de dados está indisponível. Tente de novo em instantes.",
  DATABASE_ERROR: "Houve um erro interno. Tente de novo em instantes.",
  OUTBOUND_SSRF: "A mensagem contém um endereço que a política não permite.",
  OUTBOUND_FORBIDDEN_FIELD: "A mensagem contém um campo que a política não permite.",
  LABELS_SELF_ONLY: "Só é possível atualizar o próprio nome e e-mail desta forma.",
  TEAM_EXISTS: "Já existe uma equipe com este identificador.",
};

function withSupport(text: string, requestId?: string): string {
  if (!requestId) {
    return text;
  }
  return `${text} Código de suporte: ${requestId}.`;
}

export function isGatewayError(error: unknown): error is GatewayError {
  return Boolean(error && typeof error === "object" && "status" in error && "message" in error);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function asError(status: number, body: unknown, requestId?: string): GatewayError {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") {
      return { status, message: detail, requestId };
    }
    if (detail && typeof detail === "object") {
      const rec = detail as { reason_code?: unknown; message?: unknown };
      const reasonCode = typeof rec.reason_code === "string" ? rec.reason_code : undefined;
      const message =
        typeof rec.message === "string"
          ? rec.message
          : reasonCode
            ? reasonCode
            : `Erro HTTP ${status}`;
      return { status, reasonCode, message, requestId };
    }
  }
  return { status, message: `Erro HTTP ${status}`, requestId };
}

export function formatGatewayError(error: GatewayError): string {
  if (error.reasonCode && SUPPORT[error.reasonCode]) {
    return withSupport(SUPPORT[error.reasonCode], error.requestId);
  }
  if (error.status === 401) {
    return withSupport("Sessão expirada. Entre novamente com a conta da empresa.", error.requestId);
  }
  if (error.status === 403) {
    return withSupport(
      "Você não tem permissão para esta ação. Peça ao administrador se precisar de acesso.",
      error.requestId,
    );
  }
  if (error.status === 402) {
    return withSupport(
      "Não há mais saldo disponível: orçamento da equipe ou créditos do provedor. Fale com o administrador.",
      error.requestId,
    );
  }
  if (error.status === 429) {
    return withSupport("Muitas perguntas em pouco tempo. Espere um instante e tente de novo.", error.requestId);
  }
  if (error.status >= 500) {
    return withSupport("O assistente está indisponível no momento. Tente de novo em instantes.", error.requestId);
  }
  const fallback =
    error.message && !/^[A-Z][A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "Não foi possível concluir a solicitação. Tente de novo.";
  return withSupport(fallback, error.requestId);
}

export function networkErrorMessage(error: unknown): string {
  if (isAbortError(error)) {
    return "A geração da resposta foi interrompida.";
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "Não foi possível conectar ao assistente. Tente de novo em alguns segundos.";
  }
  if (isGatewayError(error)) {
    return formatGatewayError(error);
  }
  if (error instanceof Error) {
    return friendlyAuthError(error.message);
  }
  return "Não foi possível concluir a solicitação. Tente de novo.";
}

export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (/redirect_uri|invalid request|aadsts/.test(lower) || /msal/i.test(message)) {
    return "Não foi possível entrar com a conta da empresa. Confirme com o administrador se o aplicativo está cadastrado no Microsoft 365.";
  }
  if (/login|token|entra|unauthorized/i.test(message)) {
    return "Não foi possível validar a sessão. Entre novamente com a conta da empresa.";
  }
  if (/faça login/i.test(message)) {
    return "Entre com a conta da empresa para continuar.";
  }
  return message;
}

export function toolDisplayName(id: string): string {
  if (id === "consultar_estoque") return "Estoque";
  if (id === "consultar_vendas") return "Vendas";
  if (id === "buscar_documentos") return "Documentos";
  return id;
}

export function toolBusyLabel(id: string): string {
  if (id === "consultar_estoque") return "Consultando estoque…";
  if (id === "consultar_vendas") return "Consultando vendas…";
  if (id === "buscar_documentos") return "Consultando documentos da equipe…";
  return "Buscando informações…";
}

export function healthCheckLabel(name: string): string {
  if (name === "postgres") return "Banco de dados";
  if (name === "redis") return "Cache";
  if (name === "litellm") return "Modelos";
  if (name === "orchestrator") return "Assistente";
  return name;
}
