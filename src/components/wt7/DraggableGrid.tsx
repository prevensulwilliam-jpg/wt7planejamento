/**
 * DraggableGrid — componente genérico de grid com drag-and-drop
 * Persiste ordem no localStorage via storageKey.
 * Usado em AssetsPage (Bens/Investimentos/Consórcios) e ConstructionsPage (Projetos).
 */
import { useState, useRef, useCallback } from "react";

function useLocalOrder<T extends { id: string }>(key: string, items: T[]): [T[], (newOrder: T[]) => void] {
  const load = (): string[] | null => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
  };
  const savedOrder = load();
  const sorted: T[] = savedOrder
    ? [...items].sort((a, b) => {
        const ai = savedOrder.indexOf(a.id);
        const bi = savedOrder.indexOf(b.id);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      })
    : items;
  const save = (newOrder: T[]) => {
    localStorage.setItem(key, JSON.stringify(newOrder.map(x => x.id)));
  };
  return [sorted, save];
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
  const [orderedItems, saveOrder] = useLocalOrder(storageKey, items);
  const [order, setOrder] = useState<T[]>(orderedItems);
  const draggingId  = useRef<string | null>(null);
  const dragOverId  = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  // Sync: preserva ordem salva mas usa objetos ATUAIS de items
  const synced  = order.map(o => items.find(i => i.id === o.id)).filter((x): x is T => !!x);
  const missing = items.filter(i => !order.find(o => o.id === i.id));
  const display = [...synced, ...missing];

  const onDragStart = useCallback((id: string) => {
    draggingId.current = id;
    setDragging(id);
  }, []);

  const onDragEnter = useCallback((id: string) => {
    dragOverId.current = id;
  }, []);

  const onDragEnd = useCallback(() => {
    if (draggingId.current && dragOverId.current && draggingId.current !== dragOverId.current) {
      setOrder(prev => {
        const synced2  = prev.map(o => items.find(i => i.id === o.id)).filter((x): x is T => !!x);
        const missing2 = items.filter(i => !prev.find(o => o.id === i.id));
        const cur = [...synced2, ...missing2];
        const from = cur.findIndex(i => i.id === draggingId.current);
        const to   = cur.findIndex(i => i.id === dragOverId.current);
        const next = [...cur];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        saveOrder(next);
        return next;
      });
    }
    draggingId.current = null;
    dragOverId.current = null;
    setDragging(null);
  }, [items, saveOrder]);

  return (
    <div className={`grid ${columns} gap-4`}>
      {display.map(item => (
        <div
          key={item.id}
          draggable
          onDragStart={() => onDragStart(item.id)}
          onDragEnter={() => onDragEnter(item.id)}
          onDragEnd={onDragEnd}
          onDragOver={e => e.preventDefault()}
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
