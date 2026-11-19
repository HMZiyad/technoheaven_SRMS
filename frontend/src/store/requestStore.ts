import { create } from 'zustand';
import { ServiceRequest, StatsSummary } from '../types';

interface RequestState {
  requests: Record<string, ServiceRequest>;
  stats: StatsSummary | null;
  lastEventId: string | null;

  setRequests: (list: ServiceRequest[]) => void;
  upsertRequest: (req: ServiceRequest) => void;
  patchRequest: (id: string, patch: Partial<ServiceRequest>) => void;
  removeRequest: (id: string) => void;
  setStats: (stats: StatsSummary) => void;
  setLastEventId: (id: string) => void;
  clearRequests: () => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  requests: {},
  stats: null,
  lastEventId: null,

  setRequests: (list: ServiceRequest[]) =>
    set((state) => {
      const next: Record<string, ServiceRequest> = {};
      // Populate new list
      list.forEach((req) => {
        next[req.id] = req;
      });
      return { requests: next };
    }),

  upsertRequest: (req: ServiceRequest) =>
    set((state) => {
      const existing = state.requests[req.id];
      const merged = existing ? { ...existing, ...req } : req;
      return {
        requests: {
          ...state.requests,
          [req.id]: merged,
        },
      };
    }),

  patchRequest: (id: string, patch: Partial<ServiceRequest>) =>
    set((state) => {
      const existing = state.requests[id];
      if (!existing) {
        // If not in state, do not create partial broken entity
        return state;
      }
      return {
        requests: {
          ...state.requests,
          [id]: {
            ...existing,
            ...patch,
          },
        },
      };
    }),

  removeRequest: (id: string) =>
    set((state) => {
      if (!state.requests[id]) return state;
      const next = { ...state.requests };
      delete next[id];
      return { requests: next };
    }),

  setStats: (stats: StatsSummary) => set({ stats }),

  setLastEventId: (id: string) => set({ lastEventId: id }),

  clearRequests: () => set({ requests: {}, stats: null, lastEventId: null }),
}));

export default useRequestStore;
