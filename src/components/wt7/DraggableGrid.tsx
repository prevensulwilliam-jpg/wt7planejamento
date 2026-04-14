/**
 * DraggableGrid — componente genérico de grid com drag-and-drop
 * Persiste ordem no localStorage via storageKey.
 * Usado em AssetsPage (Bens/Investimentos/Consórcios) e ConstructionsPage (Projetos).
 *
 * Estado interno: apenas IDs (strings) — nunca objetos completos.
 * display sempre usa os objetos ATUAIS de items → sem dados sumindo.
 * Target rastreado via onDragOver (contínuo) → mais confiável que onDragEnter.
 */
import { useState, useRef, useCallback, useMemo } from "react";

function loadSavedOrder(key: string): string[] | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
}

interface DraggableGridProps<T extends { id: string }> {
  storageKey: string;
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  columns?: string;
}

export function DraggableGrid<T extends { id: string }>({
  storageKey,
  items,
  renderCard,
  columns = "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
}: DraggableGridProps<T>) {
  // Guarda apenas IDs — nunca objetos
  const [orderIds, setOrderIds] = useState<string[]>(() => {
    const saved = loadSavedOrder(storageKey);
    return saved ?? items.map(i => i.id);
  });

  const [dragging, setDragging] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  // display: reconstruído SEMPRE a partir dos items atuais, só a sequência vem dos IDs
  const display = useMemo(() => {
    const result: T[] = [];
    for (const id of orderIds) {
      const item = items.find(i => i.id === id);
      if (item) result.push(item);
    }
    // itens novos ainda não na ordem salva
    for (const item of items) {
      if (!orderIds.includes(item.id)) result.push(item);
    }
    return result;
  }, [items, orderIds]);

  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    draggingId.current = id;
    dragOverId.current = id;
    setDragging(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  // onDragOver rastreia o card alvo continuamente (mais confiável que onDragEnter)
  const onDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggingId.current) {
      dragOverId.current = id;
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent, toId: string) => {
    e.preventDefault();
    dragOverId.current = toId;
  }, []);

  const onDragEnd = useCallback(() => {
    const from = draggingId.current;
    const to = dragOverId.current;

    if (from && to && from !== to) {
      setOrderIds(prev => {
        // Constrói lista completa de IDs (inclui novos itens sem ordem salva)
        const allIds: string[] = [];
        for (const id of prev) {
          if (items.find(i => i.id === id)) allIds.push(id);
        }
        for (const item of items) {
          if (!allIds.includes(item.id)) allIds.push(item.id);
        }

        const fromIdx = allIds.indexOf(from);
        const toIdx = allIds.indexOf(to);
        if (fromIdx === -1 || toIdx === -1) return prev;

        const next = [...allIds];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);

        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    }

    draggingId.current = null;
    dragOverId.current = null;
    setDragging(null);
  }, [items, storageKey]);

  return (
    <div className={`grid ${columns} gap-4`}>
      {display.map(item => (
        <div
          key={item.id}
          draggable
          onDragStart={e => onDragStart(e, item.id)}
          onDragOver={e => onDragOver(e, item.id)}
          onDrop={e => onDrop(e, item.id)}
          onDragEnd={onDragEnd}
          style={{
            opacity: dragging === item.id ? 0.4 : 1,
            transition: 'opacity 0.15s',
            cursor: 'grab',
          }}
        >
          {renderCard(item)}
        </div>
      ))}
    </div>
  );
}
