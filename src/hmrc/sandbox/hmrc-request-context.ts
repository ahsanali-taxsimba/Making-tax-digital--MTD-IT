import { AsyncLocalStorage } from "async_hooks";
import { HmrcRequestScope } from "./hmrc-sandbox.mode";

const store = new AsyncLocalStorage<HmrcRequestScope>();

export function runHmrcScope<T>(scope: HmrcRequestScope, fn: () => T): T {
  return store.run(scope, fn);
}

export function currentHmrcScope(): HmrcRequestScope | undefined {
  return store.getStore();
}
