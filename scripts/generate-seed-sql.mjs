// Gera SEED_NAVAL_MEMORY.sql com o conteúdo dos .md embutido em INSERTs.
// Uso: node scripts/generate-seed-sql.mjs
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MEMORY_DIR = "C:\\Users\\Usuário\\.claude\\memoria";
const OUT = "SEED_NAVAL_MEMORY.sql";

const WHITELIST = [
  "identidade.md", "metas.md", "negocios.md", "empresa_produtos.md",
  "historico_profissional.md", "projetos_atuais.md", "preferencias.md",
  "aprendizados.md", "vida_pessoal.md", "familia.md",
];

const esc = (s) => s.replace(/'/g, "''");

const files = (await readdir(MEMORY_DIR)).filter((f) => WHITELIST.includes(f));
const rows = [];
for (const f of files) {
  const content = await readFile(join(MEMORY_DIR, f), "utf-8");
  const slug = f.replace(/\.md$/, "");
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = (titleMatch?.[1] ?? slug).trim();
  rows.push({ slug, title, content, priority: WHITELIST.indexOf(f) });
}

const header = `-- SEED_NAVAL_MEMORY.sql
-- Popula naval_memory com o conteúdo dos .md de ~/.claude/memoria/
-- Gerado em ${new Date().toISOString()}
-- Rodar no Lovable → SQL Editor após MIGRATIONS_TO_RUN.sql

`;

const inserts = rows.map((r) =>
  `INSERT INTO public.naval_memory (slug, title, content, priority, updated_at)
VALUES ('${esc(r.slug)}', '${esc(r.title)}', '${esc(r.content)}', ${r.priority}, now())
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  updated_at = now();`
).join("\n\n");

await writeFile(OUT, header + inserts + "\n");
console.log(`✅ ${OUT} gerado com ${rows.length} arquivos`);
