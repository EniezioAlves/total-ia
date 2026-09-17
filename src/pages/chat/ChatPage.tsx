import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Menu, PanelLeftClose, Plus, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, startTransition, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

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
import { MarkdownBody, previewPlain } from "../../components/MarkdownBody";
import { VoiceMicButton } from "../../components/VoiceMicButton";

const THREADS_WIDTH_KEY = "total-ia.threads-width";
const THREADS_OPEN_KEY = "total-ia.threads-open";
const THREADS_MIN = 200;
const THREADS_MAX = 520;
const THREADS_DEFAULT = 288;

function readNumber(key: string, fallback: number): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return raw !== "0";
  } catch {
    return fallback;
  }
}

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

function CopyReplyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  if (!text.trim()) {
    return null;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className="mt-1 inline-flex rounded-md p-1 text-muted hover:bg-ice hover:text-navy"
      aria-label={copied ? "Copiado" : "Copiar resposta"}
      title={copied ? "Copiado" : "Copiar"}
      onClick={() => void copy()}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
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
  const [dictating, setDictating] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [threadsOpen, setThreadsOpen] = useState(() => readFlag(THREADS_OPEN_KEY, true));
  const [threadsWidth, setThreadsWidth] = useState(() =>
    Math.min(THREADS_MAX, Math.max(THREADS_MIN, readNumber(THREADS_WIDTH_KEY, THREADS_DEFAULT))),
  );
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages, toolName, busy]);

  useEffect(() => {
    try {
      localStorage.setItem(THREADS_WIDTH_KEY, String(threadsWidth));
    } catch {
      /* ignore quota */
    }
  }, [threadsWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(THREADS_OPEN_KEY, threadsOpen ? "1" : "0");
    } catch {
      /* ignore quota */
    }
  }, [threadsOpen]);

  useEffect(() => {
    function endDrag() {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
    };
  }, []);

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: threadsWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const next = drag.startWidth + (event.clientX - drag.startX);
    setThreadsWidth(Math.round(Math.min(THREADS_MAX, Math.max(THREADS_MIN, next))));
  }

  function onResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

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
    let paint = 0;
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
      const paintAssistant = () => {
        paint = 0;
        const snapshot = assistant;
        const src = sources;
        startTransition(() => {
          setMessages((current) => {
            const next = [...current];
            next[next.length - 1] = { role: "assistant", content: snapshot, sources: src };
            return next;
          });
        });
      };
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
          if (!paint) {
            paint = requestAnimationFrame(paintAssistant);
          }
        }
        if (event.type === "done") {
          finished = true;
          assistant = event.data.content || assistant;
          if (paint) {
            cancelAnimationFrame(paint);
            paint = 0;
          }
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
      if (paint) {
        cancelAnimationFrame(paint);
      }
      abortRef.current = null;
      setBusy(false);
      setToolName("");
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="absolute inset-0 flex min-h-0 overflow-hidden">
      <section
        className={`${
          listOpen ? "absolute inset-y-0 left-0 z-20 flex w-[min(22rem,90vw)]" : "hidden"
        } min-h-0 shrink-0 flex-col overflow-hidden border-r border-line bg-white md:static md:w-[var(--threads-width)] ${threadsOpen ? "md:flex" : "md:hidden"}`}
        style={{ "--threads-width": `${threadsWidth}px` } as CSSProperties}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-4">
          <h2 className="text-sm font-semibold">Conversas</h2>
          <div className="flex items-center gap-1">
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
              Nova
            </button>
            <button
              type="button"
              className="hidden rounded-lg p-1.5 text-muted hover:bg-ice hover:text-navy md:inline-flex"
              aria-label="Esconder conversas"
              title="Esconder conversas"
              onClick={() => setThreadsOpen(false)}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>
        <div className="h-0 min-h-0 flex-1 overflow-auto px-2 pb-3">
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
                  {previewPlain(thread.preview || "") || "Nova conversa"}
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
      {threadsOpen ? (
        <div className="relative z-30 hidden w-0 shrink-0 self-stretch md:block">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar coluna de conversas"
            title="Arraste para aumentar ou diminuir"
            className="absolute inset-y-0 -left-1.5 w-3 cursor-col-resize"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
          />
        </div>
      ) : null}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {session.ready && !session.invoke ? (
          <p className="border-b border-line bg-white px-4 py-4 text-sm text-danger md:px-6">
            Sua conta não tem permissão para usar o assistente. Peça ao administrador para
            liberar o acesso.
          </p>
        ) : null}
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2 md:gap-3 md:px-6 md:py-3">
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-sm text-navy ${
              threadsOpen ? "md:hidden" : ""
            }`}
            onClick={() => {
              if (window.matchMedia("(min-width: 768px)").matches) {
                setThreadsOpen(true);
              } else {
                setListOpen(true);
              }
            }}
          >
            <Menu size={16} />
            Conversas
          </button>
          <label className="text-sm text-muted">
            Modelo
            <select
              className="ml-2 max-w-[10rem] rounded-lg border border-line bg-white px-2 py-1 text-base text-ink md:max-w-none md:text-sm"
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
          <div className="flex max-w-full gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <div
          ref={listRef}
          className="h-0 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 [overflow-anchor:none] md:px-6 md:py-6"
        >
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
                    className={`min-w-0 max-w-[min(92%,42rem)] overflow-hidden rounded-2xl px-3 py-3 leading-6 md:max-w-[min(85%,42rem)] md:px-4 ${
                      item.role === "user" ? "ml-auto bg-navy text-white" : "bg-white text-ink shadow-sm"
                    }`}
                  >
                    <MarkdownBody
                      tone={item.role === "user" ? "dark" : "light"}
                      streaming={
                        item.role === "assistant" && busy && index === messages.length - 1
                      }
                      text={
                        item.content ||
                        (item.role === "assistant" && busy && index === messages.length - 1 ? "…" : "")
                      }
                    />
                    {item.role === "assistant" && item.sources?.length ? (
                      <p className="mt-2 break-words text-[11px] text-muted [overflow-wrap:anywhere]">
                        Fontes: {item.sources.join(" · ")}
                      </p>
                    ) : null}
                    {item.role === "assistant" ? (
                      <div className="flex justify-end">
                        <CopyReplyButton text={item.content} />
                      </div>
                    ) : null}
                  </div>
                ))}
              {toolName ? (
                <div className="text-sm text-accent">{toolBusyLabel(toolName)}</div>
              ) : null}
            </div>
          )}
        </div>

        <form
          className="shrink-0 border-t border-line bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 md:gap-3">
            <textarea
              className="max-h-36 min-h-12 flex-1 resize-y rounded-xl border border-line px-3 py-2 text-base md:min-h-16 md:text-sm"
              placeholder={dictating ? "Ouvindo…" : "Escreva sua pergunta…"}
              value={draft}
              disabled={busy || dictating}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
            />
            <VoiceMicButton
              disabled={busy || !models.length}
              draft={draft}
              onDraft={setDraft}
              onError={setError}
              onListeningChange={setDictating}
            />
            {busy ? (
              <button
                type="button"
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-line px-3 py-2 font-medium text-navy md:px-4 md:py-3"
                onClick={stop}
              >
                <Square size={14} />
                Parar
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() || !models.length}
                className="min-h-11 shrink-0 rounded-xl bg-accent px-3 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50 md:px-4 md:py-3"
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
            <p className="mx-auto mt-2 hidden max-w-3xl text-xs text-muted md:block">
              Enter envia · Shift+Enter quebra linha
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
