import { AsyncLocalStorage } from "async_hooks";
import { FraudPreventionContext } from "../hmrc.types";
import { HmrcRequestScope } from "./hmrc-sandbox.mode";

export interface HmrcAlsStore extends HmrcRequestScope {
  fraud?: FraudPreventionContext;
}

const store = new AsyncLocalStorage<HmrcAlsStore>();

export function runHmrcScope<T>(scope: HmrcAlsStore, fn: () => T): T {
  return store.run(scope, fn);
}

export function currentHmrcScope(): HmrcAlsStore | undefined {
  return store.getStore();
}
