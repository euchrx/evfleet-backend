import { AsyncLocalStorage } from 'async_hooks';

export type RequestScopeState = {
  companyId?: string;
};

const storage = new AsyncLocalStorage<RequestScopeState>();

export const RequestScope = {
  run<T>(state: RequestScopeState, callback: () => T): T {
    return storage.run(state, callback);
  },
  getCompanyId(): string | undefined {
    return storage.getStore()?.companyId;
  },
};
