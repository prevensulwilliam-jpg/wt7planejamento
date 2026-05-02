/**
 * Logger central WT7.
 *
 * Substitui console.log/error/warn espalhados.
 * Vantagens:
 * - Prefixo padronizado [WT7] por escopo
 * - Filtro fácil em produção (LOG_LEVEL)
 * - Pode plugar Sentry/LogRocket no futuro sem refactor
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   const log = logger.scope("KitnetModal");
 *   log.error("save failed", { kitnetId, error });
 *   log.warn("...");
 *   log.info("...");
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Em produção, default 'warn' (silencia debug/info). Override via env.
const ENV_LEVEL = (import.meta.env?.VITE_LOG_LEVEL as LogLevel) ||
  (import.meta.env?.PROD ? "warn" : "debug");
const MIN_LEVEL = LEVEL_ORDER[ENV_LEVEL] ?? LEVEL_ORDER.warn;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= MIN_LEVEL;
}

function log(scope: string, level: LogLevel, message: string, context?: unknown) {
  if (!shouldLog(level)) return;
  const prefix = `[WT7:${scope}]`;
  const fn = level === "error" ? console.error
    : level === "warn" ? console.warn
    : level === "info" ? console.info
    : console.debug;
  if (context !== undefined) {
    fn(prefix, message, context);
  } else {
    fn(prefix, message);
  }
  // Hook futuro pra Sentry/LogRocket:
  // if (level === "error" && window.Sentry) window.Sentry.captureMessage(message, { extra: context });
}

export const logger = {
  scope(scope: string) {
    return {
      debug: (msg: string, ctx?: unknown) => log(scope, "debug", msg, ctx),
      info: (msg: string, ctx?: unknown) => log(scope, "info", msg, ctx),
      warn: (msg: string, ctx?: unknown) => log(scope, "warn", msg, ctx),
      error: (msg: string, ctx?: unknown) => log(scope, "error", msg, ctx),
    };
  },
  // Atalho sem scope
  debug: (msg: string, ctx?: unknown) => log("global", "debug", msg, ctx),
  info: (msg: string, ctx?: unknown) => log("global", "info", msg, ctx),
  warn: (msg: string, ctx?: unknown) => log("global", "warn", msg, ctx),
  error: (msg: string, ctx?: unknown) => log("global", "error", msg, ctx),
};
