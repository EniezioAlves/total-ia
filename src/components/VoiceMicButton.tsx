import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function recognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function joinParts(base: string, spoken: string): string {
  const left = base.trimEnd();
  const right = spoken.trim();
  if (!right) {
    return left;
  }
  if (!left) {
    return right;
  }
  return `${left} ${right}`;
}

function voiceErrorMessage(code: string): string {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "Permita o microfone no navegador para ditar a pergunta.";
  }
  if (code === "audio-capture") {
    return "Nenhum microfone foi encontrado.";
  }
  if (code === "no-speech") {
    return "Não ouvi nada. Clique no microfone e fale de novo.";
  }
  return "Não foi possível usar o microfone. Tente no Chrome ou no Edge.";
}

export function VoiceMicButton({
  disabled,
  draft,
  onDraft,
  onError,
  onListeningChange,
}: {
  disabled?: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onError: (message: string) => void;
  onListeningChange?: (listening: boolean) => void;
}) {
  const Ctor = recognitionCtor();
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const baseRef = useRef(draft);
  const finalsRef = useRef("");
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    onListeningChange?.(listening);
  }, [listening, onListeningChange]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (disabled && listening) {
      recRef.current?.stop();
    }
  }, [disabled, listening]);

  if (!Ctor) {
    return null;
  }

  function stop() {
    recRef.current?.stop();
  }

  function start() {
    if (!Ctor) {
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = draftRef.current;
    finalsRef.current = "";
    rec.onresult = (event) => {
      let finals = finalsRef.current;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finals = joinParts(finals, piece);
        } else {
          interim += piece;
        }
      }
      finalsRef.current = finals;
      onDraft(joinParts(baseRef.current, joinParts(finals, interim)));
    };
    rec.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      onError(voiceErrorMessage(event.error));
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      onError("");
    } catch {
      onError("Não foi possível iniciar o microfone.");
      recRef.current = null;
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border md:h-auto md:w-auto md:px-3 md:py-3 ${
        listening
          ? "border-muted bg-muted text-white"
          : "border-line text-navy hover:bg-ice disabled:opacity-50"
      }`}
      aria-label={listening ? "Parar ditado" : "Ditar pergunta"}
      aria-pressed={listening}
      title={listening ? "Parar" : "Falar"}
      onClick={() => {
        if (listening) {
          stop();
        } else {
          start();
        }
      }}
    >
      <Mic size={18} />
    </button>
  );
}
