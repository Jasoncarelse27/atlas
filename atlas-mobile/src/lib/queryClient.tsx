import React, { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// keep React Query aware of connectivity
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener(state => setOnline(!!state.isConnected))
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime:   30 * 60 * 1000,
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'atlas-query-cache-v1',
  throttleTime: 1000,
});

function AtlasQueryProvider({ children }: PropsWithChildren) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PersistQueryClientProvider>
  );
}

// default export avoids named-import mixups in App.tsx
export default AtlasQueryProvider;