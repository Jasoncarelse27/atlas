import { act, renderHook } from "@testing-library/react";
import { useConversationHistory } from "../hooks/useConversationHistory";

const items = [
  { id: "a", title: "Alpha",  pinned: false, updatedAt: "2025-09-08T10:00:00Z" },
  { id: "b", title: "Bravo",  pinned: true,  updatedAt: "2025-09-08T11:00:00Z" },
  { id: "c", title: "Charlie", pinned: false, updatedAt: "2025-09-07T10:00:00Z" },
];

test("filters by search and prioritizes pinned", () => {
  const { result } = renderHook(() => useConversationHistory(items));
  expect(result.current.list[0].id).toBe("b"); // pinned first by default
  act(() => result.current.setFilters(f => ({ ...f, q: "al" })));
  expect(result.current.list.map(i => i.id)).toEqual(["a"]); // 'al' in alpha only
});
