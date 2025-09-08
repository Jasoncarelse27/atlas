import { useMemo, useState } from "react";

export type HistoryItem = {
  id: string;
  title: string;
  pinned?: boolean;
  updatedAt: string;
};

type Filters = { 
  q: string; 
  sort: "recent" | "title"; 
  from?: Date | null; 
  to?: Date | null; 
  showPinnedFirst?: boolean; 
};

export function useConversationHistory(items: HistoryItem[]) {
  const [filters, setFilters] = useState<Filters>({ 
    q: "", 
    sort: "recent", 
    showPinnedFirst: true 
  });

  const filtered = useMemo(() => {
    const q = filters.q.toLowerCase();
    let out = items.filter(i => i.title.toLowerCase().includes(q));
    
    if (filters.from || filters.to) {
      out = out.filter(i => {
        const t = new Date(i.updatedAt).getTime();
        const from = filters.from?.getTime() ?? -Infinity;
        const to = (filters.to?.getTime() ?? Infinity) + 1000; // inclusive
        return t >= from && t <= to;
      });
    }
    
    out.sort((a, b) => {
      if (filters.showPinnedFirst) {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      }
      if (filters.sort === "recent") return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      return a.title.localeCompare(b.title);
    });
    
    return out;
  }, [items, filters]);

  // Cache configuration for future useConversationHistoryQuery
  // staleTime: 10 * 60 * 1000, // 10 minutes
  // gcTime: 60 * 60 * 1000,    // 1 hour

  return { filters, setFilters, list: filtered };
}
