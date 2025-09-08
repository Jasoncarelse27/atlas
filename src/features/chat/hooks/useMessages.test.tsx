import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMessages } from "./useMessages";

function wrapper({ children }: any) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

test("lists messages and supports sending", async () => {
  const { result } = renderHook(() => useMessages("TEST"), { wrapper });
  await waitFor(() => expect(result.current.list.data?.length).toBeGreaterThan(0));
  const before = result.current.list.data!.length;
  await act(async () => { await result.current.send.mutateAsync("hello"); });
  await waitFor(() => expect(result.current.list.data!.length).toBeGreaterThan(before));
});
