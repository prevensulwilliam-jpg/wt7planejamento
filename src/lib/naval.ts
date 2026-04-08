import { supabase } from "@/integrations/supabase/client";

export type NavalMessage = { role: string; content: string };

type ResponseLike = {
  status: number;
  clone: () => Response;
};

const NAVAL_REQUEST_DELAY_MS = 1200;
const DEFAULT_NAVAL_ERROR = "Erro ao conectar com o Naval. Tente novamente.";

let navalQueue: Promise<unknown> = Promise.resolve();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isResponseLike(value: unknown): value is ResponseLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as { status?: unknown }).status === "number" &&
    "clone" in value &&
    typeof (value as { clone?: unknown }).clone === "function"
  );
}

async function readFunctionError(response: ResponseLike): Promise<string | null> {
  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === "object") {
      const error = "error" in payload ? payload.error : null;
      if (typeof error === "string" && error.trim()) return error;

      const message = "message" in payload ? payload.message : null;
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    // fall through to text parsing
  }

  try {
    const text = await response.clone().text();
    if (!text.trim()) return null;

    try {
      const payload = JSON.parse(text);
      if (payload && typeof payload === "object") {
        const error = "error" in payload ? payload.error : null;
        if (typeof error === "string" && error.trim()) return error;

        const message = "message" in payload ? payload.message : null;
        if (typeof message === "string" && message.trim()) return message;
      }
    } catch {
      // non-JSON text body
    }

    return text;
  } catch {
    return null;
  }
}

async function normalizeNavalError(error: unknown): Promise<Error> {
  const context =
    typeof error === "object" && error !== null && "context" in error
      ? (error as { context?: unknown }).context
      : null;

  if (isResponseLike(context)) {
    const detail = await readFunctionError(context);

    if (context.status === 402) {
      return new Error(detail ?? "Créditos esgotados. Adicione fundos no workspace.");
    }

    if (context.status === 429) {
      return new Error(detail ?? "Limite de requisições excedido. Tente novamente em alguns segundos.");
    }

    if (detail) {
      return new Error(detail);
    }
  }

  if (error instanceof Error && error.message) {
    return new Error(error.message);
  }

  return new Error(DEFAULT_NAVAL_ERROR);
}

function enqueueNavalRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = navalQueue.then(task, task);
  navalQueue = run.catch(() => undefined).then(() => delay(NAVAL_REQUEST_DELAY_MS));
  return run;
}

export async function getNavalErrorMessage(error: unknown): Promise<string> {
  const normalized = await normalizeNavalError(error);
  return normalized.message || DEFAULT_NAVAL_ERROR;
}

export async function callNaval(messages: NavalMessage[]): Promise<string> {
  return enqueueNavalRequest(async () => {
    const { data, error } = await supabase.functions.invoke("wisely-ai", {
      body: { messages, stream: false },
    });

    if (error) {
      throw await normalizeNavalError(error);
    }

    if (data?.error) {
      throw new Error(
        typeof data.error === "string" && data.error.trim()
          ? data.error
          : DEFAULT_NAVAL_ERROR,
      );
    }

    return typeof data?.text === "string" ? data.text : "";
  });
}
