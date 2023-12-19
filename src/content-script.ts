import { browser } from "browser-namespace";

import {
  createActivationSuccessMessage,
  isRequestActivationMessage,
  type RequestActivationContext,
} from "./messages.js";

/**
 * Sets up the content script activation system in the content script.
 */
export function setupActivation(
  /**
   * Called when the content script is activated.
   */
  onActivation?: (
    /**
     * The context of the activation request.
     */
    context: RequestActivationContext,
    /**
     * The ID of the script that was activated, if it was provided.
     */
    scriptId?: string,
  ) => void,
  scriptId?: string,
) {
  browser.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (isRequestActivationMessage(message) && message.scriptId === scriptId) {
      onActivation?.(message.context, scriptId);
      // @ts-expect-error Bad types?
      sendResponse(createActivationSuccessMessage(scriptId));
    }
  });
}
