import { AsyncLocalStorage } from "async_hooks";

export const requestContext = new AsyncLocalStorage<{
  correlationId: string;
  userId?: string;
}>();

export function getContext() {
  return requestContext.getStore() ?? { correlationId: "none" };
}
