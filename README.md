# Total IA

Plataforma web da **Total Distribuidora** para o [AI Gateway](https://github.com/EniezioAlves/ai-gateway). Login Microsoft Entra (MSAL) e chamadas **só** a `http://127.0.0.1:8080`. Não há URL nem chave do LiteLLM neste projeto. O Orchestrator não é público: o Gateway encaminha threads e runs.

Pasta irmã do repositório `ai-gateway` (`Desktop/total-ia`).

## O que a plataforma faz

- **Assistente:** conversas persistentes (`GET/POST /v1/threads`), streaming SSE (`POST /v1/threads/{id}/runs`), tools efetivas (`GET /v1/agent/tools`).
- **Gestão (`gateway.admin`):** equipes (modelos, tools, limites), mappings Entra (nome/e-mail do Graph, persistidos no cadastro), denylist, auditoria (sem prompt) e saúde (`/health/ready`).
- Toda chamada envia `X-Request-ID` para correlacionar com a auditoria do Gateway.

## Antes de abrir

1. Gateway no ar (nginx `:8080`) com Entra em produção, ou bootstrap local.
2. No `.env` do Gateway: `GATEWAY_CORS_ORIGINS=["http://localhost:5173"]`. Recrie o serviço `gateway` depois de mudar isso.
3. No Entra, no **mesmo** app cliente que está em `GATEWAY_ENTRA_ALLOWED_CLIENT_IDS`:
   - Plataforma **Single-page application** (não “Web”)
   - Redirect URI **exata**: `http://localhost:5173`
   - Permissão delegada `ai.invoke` (só para o Entra emitir o token da API)
   - Utilizador com app role `gateway.user` (Assistente) ou `gateway.admin` (Gestão) no aplicativo empresarial da **API**, e mapping `user_oid` no team
4. Copie `.env.example` para `.env` e preencha tenant, client ID do **cliente** (não o da API) e audience (`api://…`).

## Subir (desenvolvimento)

```powershell
cd C:\Users\eniezio.filho\Desktop\total-ia
npm install
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). No Entra, redirect URI `http://localhost:5173` (plataforma SPA).

## Subir com o Gateway (Nginx em :8080)

O Compose do `ai-gateway` constrói este SPA e o Nginx serve na mesma origem que a API (`http://127.0.0.1:8080`). No Entra, acrescente também a redirect URI `http://127.0.0.1:8080`.

```powershell
cd C:\Users\eniezio.filho\Desktop\ai-gateway
docker compose up -d --build web nginx
```

O `.env` desta pasta entra no build da imagem (IDs Entra). Não commite o `.env`.

## Erros frequentes

| Sintoma | Causa típica |
| --- | --- |
| CORS no browser | `GATEWAY_CORS_ORIGINS` vazio ou Gateway não recriado |
| Portal recusa URI / `AADSTS500113` | Falta plataforma SPA ou URI não é `http://localhost:5173` |
| `AUTH_INVALID` | Token v1 da API (`accessTokenAcceptedVersion` ≠ 2) ou ID token (falta permissão `ai.invoke` no cliente) |
| `AUTH_CLIENT` | Client ID do front fora da allowlist |
| `AUTHZ_NO_MAPPING` | Token ok, sem mapping `user_oid` |
| `AUTHZ_SCOPE` | Sem `ai.invoke` / `gateway.user` |

Detalhe do portal: no repositório do Gateway, `docs/ENTRA.md`.
