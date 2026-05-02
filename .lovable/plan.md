## Reorganizar cards de Negócios via drag-and-drop

Hoje, em `/businesses`, os cards são exibidos em 3 grupos (Recorrente, Crescimento, Incubado) usando `<div className="grid">` simples — sem possibilidade de reordenar.

O projeto já tem o componente genérico `src/components/wt7/DraggableGrid.tsx`, que:
- aceita uma lista `items` + função `renderCard`
- persiste a ordem em `localStorage` via `storageKey`
- é o mesmo padrão usado em **Bens** (AssetsPage) e **Projetos** (ConstructionsPage)

Vou reutilizar esse componente — sem nova migration, sem mudança de schema, sem backend.

### Mudanças

**Arquivo:** `src/pages/BusinessesPage.tsx` (linhas 1038–1054)

Substituir o `<div className="grid ...">{list.map(renderCard)}</div>` dentro de cada categoria por:

```tsx
<DraggableGrid
  storageKey={`wt7:businesses:order:${cat}`}
  items={list}
  renderCard={renderCard}
  columns="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
/>
```

Adicionar o import no topo:
```tsx
import { DraggableGrid } from "@/components/wt7/DraggableGrid";
```

### Comportamento resultante

- Arrastar um card pela área do card → soltar sobre outro → cards trocam de posição.
- Cada categoria (Recorrente / Crescimento / Incubado) tem sua própria ordem persistida (chaves separadas no localStorage).
- A ordem permanece após reload do navegador.
- Drag não interfere com os botões de ação (lupa/editar/lixeira) — eles continuam clicáveis normalmente; o drag inicia a partir de áreas "vazias" do card.
- Negócios novos (criados depois) aparecem no fim da lista.

### Notas

- A ordem é **local ao navegador** (localStorage), igual a Bens/Projetos. Se quiser sincronizar entre dispositivos no futuro, será necessária uma coluna `order_index` no banco — mas isso já existe (`order_index` é passado no `createBiz`), então uma evolução futura pode persistir no servidor. Por ora, mantemos consistência com os outros módulos.
- Não há mudança visual nos cards — só comportamento.
