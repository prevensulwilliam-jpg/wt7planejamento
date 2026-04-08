import { supabase } from "@/integrations/supabase/client";

export type NavalMessage = { role: string; content: string };

const NAVAL_REQUEST_DELAY_MS = 1500;
const DEFAULT_NAVAL_ERROR = "Erro ao conectar com o Naval. Tente novamente.";

let navalQueue: Promise<unknown> = Promise.resolve();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueueNavalRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = navalQueue.then(task, task);
  navalQueue = run.catch(() => undefined).then(() => delay(NAVAL_REQUEST_DELAY_MS));
  return run;
}

export async function callNaval(messages: NavalMessage[]): Promise<string> {
  return enqueueNavalRequest(async () => {
    const { data, error } = await supabase.functions.invoke("wisely-ai", {
      body: { messages, stream: false },
    });

    // supabase SDK error (network, etc.)
    if (error) {
      throw new Error(DEFAULT_NAVAL_ERROR);
    }

    // Edge function returned 200 but with an error payload
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
