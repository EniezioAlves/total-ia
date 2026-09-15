import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, Plus, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  createThread,
  deleteThread,
  listAgentTools,
  listMessages,
  listModels,
  listThreads,
  streamRun,
} from "../../api/gateway";
import { isAbortError, networkErrorMessage, toolBusyLabel, toolDisplayName } from "../../api/errors";
import type { ChatMessage, ToolItem } from "../../api/types";
import { useSession } from "../../auth/useSession";

function suggestionPrompts(tools: ToolItem[]): { label: string; text: string }[] {
  const ids = new Set(tools.map((tool) => tool.id));
  const items: { label: string; text: string }[] = [];
  if (ids.has("consultar_estoque")) {
    items.push({ label: "Estoque por SKU", text: "Qual o estoque do SKU " });
  }
  if (ids.has("consultar_vendas")) {
    items.push({ label: "Vendas", text: "Como estão as vendas de " });
  }
  if (ids.has("buscar_documentos")) {
    items.push({ label: "Documentos", text: "Nos documentos da equipe, " });
  }
  return items;
}

export function ChatPage() {
  const session = useSession(true);
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolName, setToolName] = useState("");
  const [error, setError] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const threadsQuery = useQuery({
    queryKey: ["threads"],
    queryFn: listThreads,
    enabled: session.invoke,
  });
  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: listModels,
    enabled: session.invoke,
  });
  const toolsQuery = useQuery({
    queryKey: ["agent-tools"],
    queryFn: listAgentTools,
    enabled: session.invoke,
  });

  const models = modelsQuery.data ?? [];
  const tools = toolsQuery.data ?? [];
  const threads = threadsQuery.data ?? [];
  const prompts = suggestionPrompts(tools);

  useEffect(() => {
    if (!model && models[0]) {
      setModel(models[0]);
    }
  }, [model, models]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolName, busy]);

  async function openThread(id: string) {
    setThreadId(id);
    setError("");
    setListOpen(false);
    try {
      setMessages(await listMessages(id));
    } catch (err) {
      setError(networkErrorMessage(err));
    }
  }

  const removeThread = useMutation({
    mutationFn: deleteThread,
    onSuccess: async (_, id) => {
      if (threadId === id) {
        setThreadId(null);
        setMessages([]);
      }
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (err) => setError(networkErrorMessage(err)),
  });

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) {
      return;
    }
    setBusy(true);
    setError("");
    setToolName("");
    setDraft("");
    const controller = new AbortController();
    abortRef.current = controller;
    let activeId = threadId;
    try {
      if (!activeId) {
        const created = await createThread();
        activeId = created.id;
        setThreadId(activeId);
        await queryClient.invalidateQueries({ queryKey: ["threads"] });
      }
      setMessages((current) => [...current, { role: "user", content }]);
      let assistant = "";
      let sources: string[] = [];
      let finished = false;
      setMessages((current) => [...current, { role: "assistant", content: "" }]);
      for await (const event of streamRun(activeId, content, model || undefined, controller.signal)) {
        if (event.type === "tool") {
          setToolName(event.data.name);
        }
        if (event.type === "sources" && event.data.items?.length) {
          sources = event.data.items;
        }
        if (event.type === "delta" && event.data.content) {
          assistant += event.data.content;
          const snapshot = assistant;
          setMessages((current) => {
            const next = [...current];
            next[next.length - 1] = { role: "assistant", content: snapshot, sources };
            return next;
          });
        }
        if (event.type === "done") {
          finished = true;
          assistant = event.data.content || assistant;
          setMessages((current) => {
            const next = [...current];
            next[next.length - 1] = {
              role: "assistant",
              content: assistant || "Não recebi uma resposta. Tente de novo.",
              sources,
            };
            return next;
          });
        }
        if (event.type === "error") {
          throw {
            status: event.data.status_code || 502,
            reasonCode: event.data.reason_code,
            message: event.data.message || "Não foi possível gerar a resposta.",
          };
        }
      }
      if (!finished) {
        if (controller.signal.aborted) {
          const abort = new Error("Aborted");
          abort.name = "AbortError";
          throw abort;
        }
        throw {
          status: 502,
          reasonCode: "UPSTREAM",
          message: "A resposta foi interrompida. Tente de novo.",
        };
      }
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
    } catch (err) {
      if (isAbortError(err)) {
        setMessages((current) => {
          const last = current[current.length - 1];
          if (last?.role === "assistant" && !last.content) {
            return current.slice(0, -1);
          }
          return current;
        });
        setError("A geração da resposta foi interrompida.");
        return;
      }
      setMessages((current) => {
        const last = current[current.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return current.slice(0, -1);
        }
        return current;
      });
      setError(networkErrorMessage(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
      setToolName("");
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="relative flex h-full min-h-0">
      <section
        className={`${
          listOpen ? "absolute inset-y-0 left-0 z-20 flex" : "hidden"
        } w-72 shrink-0 flex-col border-r border-line bg-white md:static md:flex`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="text-sm font-semibold">Conversas</h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
            onClick={() => {
              setThreadId(null);
              setMessages([]);
              setError("");
              setListOpen(false);
            }}
          >
            <Plus size={14} />
            Nova conversa
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {threadsQuery.isError ? (
            <p className="px-2 text-sm text-danger">{networkErrorMessage(threadsQuery.error)}</p>
          ) : null}
          {!threadsQuery.isError && !threads.length ? (
            <p className="px-2 text-sm text-muted">Nenhuma conversa ainda. Envie uma pergunta para começar.</p>
          ) : null}
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`group mb-1 flex items-start rounded-lg px-2 py-2 ${
                thread.id === threadId ? "bg-ice" : "hover:bg-ice"
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => void openThread(thread.id)}
              >
                <div className="truncate text-sm text-ink">
                  {thread.preview || "Nova conversa"}
                </div>
                <div className="text-[11px] text-muted">
                  {new Date(thread.updated_at || thread.created_at).toLocaleString("pt-BR")}
                </div>
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                title="Apagar conversa"
                onClick={() => {
                  if (window.confirm("Apagar esta conversa? Esta ação não pode ser desfeita.")) {
                    removeThread.mutate(thread.id);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
      {listOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-10 bg-navy/30 md:hidden"
          aria-label="Fechar conversas"
          onClick={() => setListOpen(false)}
        />
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col">
        {session.ready && !session.invoke ? (
          <p className="border-b border-line bg-white px-4 py-4 text-sm text-danger md:px-6">
            Sua conta não tem permissão para usar o assistente. Peça ao administrador para
            liberar o acesso.
          </p>
        ) : null}
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-3 py-3 md:px-6">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-sm text-navy md:hidden"
            onClick={() => setListOpen(true)}
          >
            <Menu size={16} />
            Conversas
          </button>
          <label className="text-sm text-muted">
            Modelo
            <select
              className="ml-2 rounded-lg border border-line bg-white px-2 py-1 text-ink"
              value={model}
              disabled={busy}
              onChange={(event) => setModel(event.target.value)}
            >
              {models.length ? (
                models.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))
              ) : (
                <option value="">Nenhum modelo liberado</option>
              )}
            </select>
          </label>
          <div className="flex flex-wrap gap-1">
            {tools.map((tool: ToolItem) => (
              <span
                key={tool.id}
                className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] text-navy"
                title={tool.description}
              >
                {toolDisplayName(tool.id)}
              </span>
            ))}
            {!tools.length ? (
              <span className="text-[11px] text-muted">
                Nenhuma ferramenta liberada para a sua equipe
              </span>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-6 md:px-6">
          {!messages.length ? (
            <div className="mx-auto max-w-2xl">
              <h1 className="text-2xl font-semibold text-navy">Como posso ajudar?</h1>
              <p className="mt-2 text-sm text-muted">
                Pergunte em português. O assistente usa o que estiver liberado para a sua equipe.
              </p>
              {prompts.length ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {prompts.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-accent"
                      onClick={() => setDraft(item.text)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages
                .filter((item) => item.role !== "system")
                .map((item, index) => (
                  <div
                    key={`${item.role}-${index}`}
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-6 ${
                      item.role === "user"
                        ? "ml-auto bg-navy text-white"
                        : "bg-white text-ink shadow-sm"
                    }`}
                  >
                    {item.content || (busy && index === messages.length - 1 ? "…" : "")}
                    {item.role === "assistant" && item.sources?.length ? (
                      <p className="mt-2 text-[11px] text-muted">
                        Fontes: {item.sources.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              {toolName ? (
                <div className="text-sm text-accent">{toolBusyLabel(toolName)}</div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form
          className="border-t border-line bg-white px-4 py-4 md:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              className="min-h-16 flex-1 resize-y rounded-xl border border-line px-3 py-2"
              placeholder="Escreva sua pergunta…"
              value={draft}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
            />
            {busy ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-line px-4 py-3 font-medium text-navy"
                onClick={stop}
              >
                <Square size={14} />
                Parar
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() || !models.length}
                className="rounded-xl bg-accent px-4 py-3 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Enviar
              </button>
            )}
          </div>
          {error ? <p className="mx-auto mt-2 max-w-3xl text-sm text-danger">{error}</p> : null}
          {!models.length && session.invoke ? (
            <p className="mx-auto mt-2 max-w-3xl text-sm text-muted">
              Nenhum modelo está liberado para a sua equipe. Peça ao administrador para configurar.
            </p>
          ) : (
            <p className="mx-auto mt-2 max-w-3xl text-xs text-muted">
              Enter envia · Shift+Enter quebra linha
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
