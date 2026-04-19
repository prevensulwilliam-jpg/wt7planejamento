/**
 * sync-naval-memory.ts
 *
 * Lê todos os arquivos .md de C:\Users\Usuário\.claude\memoria\ e faz upsert
 * na tabela `naval_memory` do Supabase (projeto hbyzmuxkgsogbxhykhhu).
 *
 * Uso:
 *   - Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - `npx tsx scripts/sync-naval-memory.ts`
 *
 * Tabela (criada pela migration em MIGRATIONS_TO_RUN.sql):
 *   naval_memory(slug text PK, title text, content text, updated_at timestamptz)
 *
 * Naval (edge function wisely-ai) lê essa tabela e injeta no system prompt.
 * Mesma fonte de verdade que o Claude Code carrega via @memoria/*.md.
 */

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const MEMORY_DIR = process.env.MEMORY_DIR ||
  "C:\\Users\\Usuário\\.claude\\memoria";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Arquivos que entram na memória do Naval (ordem = prioridade no prompt)
const WHITELIST = [
  "identidade.md",
  "metas.md",
  "negocios.md",
  "empresa_produtos.md",
  "historico_profissional.md",
  "projetos_atuais.md",
  "preferencias.md",
  "aprendizados.md",
  "vida_pessoal.md",
  "familia.md",
];

async function main() {
  console.log(`📂 Lendo ${MEMORY_DIR}`);
  const files = await readdir(MEMORY_DIR);
  const mdFiles = files.filter((f) => f.endsWith(".md") && WHITELIST.includes(f));

  if (mdFiles.length === 0) {
    console.error("❌ Nenhum arquivo .md da whitelist encontrado");
    process.exit(1);
  }

  const rows = await Promise.all(
    mdFiles.map(async (file) => {
      const content = await readFile(join(MEMORY_DIR, file), "utf-8");
      const slug = file.replace(/\.md$/, "");
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1]?.trim() ?? slug;
      return {
        slug,
        title,
        content,
        priority: WHITELIST.indexOf(file),
        updated_at: new Date().toISOString(),
      };
    }),
  );

  console.log(`🔄 Upserting ${rows.length} arquivos em naval_memory...`);
  const { error } = await supabase
    .from("naval_memory")
    .upsert(rows, { onConflict: "slug" });

  if (error) {
    console.error("❌ Erro no upsert:", error);
    process.exit(1);
  }

  console.log("✅ Naval memory sincronizada:");
  for (const r of rows) {
    console.log(`   [${r.priority}] ${r.slug} — ${r.title} (${r.content.length} chars)`);
  }
}

main().catch((e) => {
  console.error("💥 Falha:", e);
  process.exit(1);
});
