import { type Browser } from "browser-namespace";

const KEY = "[content-script-activation]";
const TYPE_REQUEST_ACTIVATION = "request-activation";
const TYPE_ACTIVATION_SUCCESS = "activation-success";

export type RequestActivationContext = {
  tab: Browser.Tabs.Tab;
  tabId: number;
};
export type RequestActivationMessage = {
  [K in typeof KEY]: typeof TYPE_REQUEST_ACTIVATION;
} & { context: RequestActivationContext; scriptId?: string };
export function createRequestActivationMessage(
  context: RequestActivationContext,
  scriptId?: string,
): RequestActivationMessage {
  return { [KEY]: TYPE_REQUEST_ACTIVATION, context, scriptId };
}
export function isRequestActivationMessage(
  message: any,
): message is RequestActivationMessage {
  return KEY in message && message[KEY] === TYPE_REQUEST_ACTIVATION;
}

export type ActivationSuccessMessage = {
  [K in typeof KEY]: typeof TYPE_ACTIVATION_SUCCESS;
} & { scriptId?: string };
export function createActivationSuccessMessage(
  scriptId?: string,
): ActivationSuccessMessage {
  return { [KEY]: TYPE_ACTIVATION_SUCCESS, scriptId };
}
export function isActivationSuccessMessage(
  message: any,
): message is ActivationSuccessMessage {
  return KEY in message && message[KEY] === TYPE_ACTIVATION_SUCCESS;
}
