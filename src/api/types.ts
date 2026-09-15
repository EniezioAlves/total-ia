export type ChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
  sources?: string[];
};

export type GatewayError = {
  status: number;
  reasonCode?: string;
  message: string;
  requestId?: string;
};

export type ModelItem = { id: string; object?: string };
export type ToolItem = {
  id: string;
  object?: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

export type ThreadItem = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  preview?: string | null;
};

export type RunStreamEvent =
  | { type: "status"; data: { status: string; run_id?: string } }
  | { type: "tool"; data: { name: string } }
  | { type: "sources"; data: { items?: string[] } }
  | { type: "delta"; data: { content: string } }
  | {
      type: "done";
      data: {
        run_id?: string;
        thread_id?: string;
        content?: string;
        tools?: string[];
        status?: string;
      };
    }
  | {
      type: "error";
      data: {
        run_id?: string;
        reason_code?: string;
        policy?: string;
        message?: string;
        status_code?: number;
      };
    };

export type Team = {
  id: string;
  litellm_team: string;
  litellm_key_secret_ref: string;
  status: string;
  models: string[];
  tools: string[];
  max_request_body: number;
  max_messages: number;
  max_prompt_chars: number;
  max_context_tokens: number;
  max_output_tokens: number;
  rpm_limit: number;
  pii_block: boolean;
  injection_block: boolean;
  monthly_budget_usd: number | string | null;
  budget_enforcement: "off" | "observe" | "enforce";
  secret_configured: boolean;
  created_at: string;
};

export type Mapping = {
  id: number;
  entra_type: string;
  entra_id: string;
  entra_role: string | null;
  display_name: string | null;
  email: string | null;
  gateway_team: string;
  litellm_team: string;
  status: string;
};

export type MappingCreate = {
  entra_type: string;
  entra_id: string;
  entra_role?: string;
  display_name?: string;
  email?: string;
};

export type MappingSessionLabels = {
  display_name?: string;
  email?: string;
};

export type DenylistEntry = {
  id: number;
  principal_type: string;
  principal_id: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
};

export type AuditEvent = {
  id: number;
  request_id: string;
  timestamp: string;
  user_oid: string | null;
  client_id: string | null;
  gateway_team: string | null;
  model: string | null;
  tool: string | null;
  decision: string;
  policy: string | null;
  reason_code: string;
  status_code: number;
  tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
};

export type AuditList = {
  object: string;
  data: AuditEvent[];
  offset: number;
  limit: number;
  total: number;
};

export type HealthReady = {
  status: string;
  checks: Record<string, boolean>;
};

export type TeamCreate = {
  id: string;
  litellm_team: string;
  litellm_key_secret_ref?: string;
  models: string[];
  tools: string[];
  max_request_body?: number;
  max_messages?: number;
  max_prompt_chars?: number;
  max_context_tokens?: number;
  max_output_tokens?: number;
  rpm_limit?: number;
  pii_block?: boolean;
  injection_block?: boolean;
  monthly_budget_usd?: number | null;
  budget_enforcement?: "off" | "observe" | "enforce";
  status?: "active" | "disabled";
};

export type TeamUpdate = {
  models?: string[];
  tools?: string[];
  max_request_body?: number;
  max_messages?: number;
  max_prompt_chars?: number;
  max_context_tokens?: number;
  max_output_tokens?: number;
  rpm_limit?: number;
  pii_block?: boolean;
  injection_block?: boolean;
  monthly_budget_usd?: number | null;
  budget_enforcement?: "off" | "observe" | "enforce";
  status?: "active" | "disabled";
};

export type SpendTotals = {
  cost_usd: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  hops: number;
  unknown_cost_hops: number;
};

export type SpendTeamRow = {
  gateway_team: string;
  cost_usd: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  hops: number;
  unknown_cost_hops: number;
  monthly_budget_usd: string | null;
  budget_enforcement: string;
  utilization: number | null;
  status: "ok" | "warning" | "exceeded" | "unbudgeted" | string;
};

export type SpendUserRow = {
  user_oid: string | null;
  client_id: string | null;
  display_name: string | null;
  email: string | null;
  gateway_team: string;
  cost_usd: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  hops: number;
};

export type SpendModelRow = {
  model: string;
  cost_usd: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  hops: number;
};

export type SpendSummary = {
  object: string;
  period_start: string;
  period_end: string;
  timezone: string;
  totals: SpendTotals;
  previous_totals: SpendTotals | null;
  by_team: SpendTeamRow[];
  by_user: SpendUserRow[];
  by_model: SpendModelRow[];
};

export type SpendSeriesPoint = {
  day: string;
  cost_usd: string;
  total_tokens: number;
  hops: number;
};

export type SpendSeries = {
  object: string;
  period_start: string;
  period_end: string;
  timezone: string;
  data: SpendSeriesPoint[];
};
