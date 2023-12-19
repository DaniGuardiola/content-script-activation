import { type Browser, browser } from "browser-namespace";

import {
  createRequestActivationMessage,
  isActivationSuccessMessage,
  type RequestActivationContext,
} from "./messages.js";

async function activateContentScript(
  context: RequestActivationContext,
  scriptId?: string,
) {
  let isInjected = false;
  try {
    const response = await browser.tabs.sendMessage(
      context.tabId,
      createRequestActivationMessage(context),
    );
    if (isActivationSuccessMessage(response))
      isInjected = response.scriptId === scriptId;
  } catch (error) {
    isInjected = false;
  }
  return isInjected;
}

type Tab = Browser.Tabs.Tab;
type ScriptInjection = Omit<Browser.Scripting.ScriptInjection, "target">;
type CSSInjection = Omit<Browser.Scripting.CSSInjection, "target">;

type InjectContext = {
  tab: Tab;
  tabId: number;
};

type InjectOptions = {
  /**
   * Called before the scripts and styles are injected.
   */
  beforeInjection?: (context: InjectContext) => void | Promise<void>;
  /**
   * Called after the scripts and styles are injected.
   */
  afterInjection?: (context: InjectContext) => void | Promise<void>;
  /**
   * Scripts to inject into the page. They can be specified as:
   * - A string or array of strings, which will be treated as the `files` option.
   * - An object or array of objects that correspond with the options passed to
   *   `browser.scripting.executeScript` (except `target`).
   */
  scripts: string | string[] | ScriptInjection | ScriptInjection[];
  /**
   * Styles to inject into the page. They can be specified as:
   * - A string or array of strings, which will be treated as the `files` option.
   * - An object or array of objects that correspond with the options passed to
   *   `browser.scripting.insertCSS` (except `target`).
   */
  styles?: string | string[] | CSSInjection | CSSInjection[];
};

/**
 * Options for the content script activation setup.
 */
export type ContentScriptActivationOptions = {
  /**
   * A function that determines whether the extension should be activated in a
   * tab. Return `true` to activate the extension, or `false` to ignore the tab.
   */
  filterTab?: (tab: Tab) => unknown;
  /**
   * Options for the content script injection. If a string or array of strings
   * is provided, it will be treated as the `scripts` option.
   */
  inject: string | string[] | InjectOptions;
  /**
   * Optional unique ID for this instance of the activation system. It must be
   * provided if multiple instances of the activation system are used.
   */
  scriptId?: string;
  /**
   * Whether to activate the content script into the current tab when the
   * extension button is clicked. If `false`, the setup function will return
   * a function that can be used to activate the content script by passing
   * a target.
   * @default true
   */
  injectOnClick?: boolean;
};

/**
 * Sets up the content script activation system in the service worker.
 */
export function setupContentScriptActivation(
  /**
   * Options for the content script activation setup. If a string or array of
   * strings is provided, it will be treated as the `inject.scripts` option.
   */
  options:
    | string
    | string[]
    | (ContentScriptActivationOptions & { injectOnClick?: true }),
): void;
/**
 * Sets up the content script activation system in the service worker.
 */
export function setupContentScriptActivation(
  /**
   * Options for the content script activation setup. If a string or array of
   * strings is provided, it will be treated as the `inject.scripts` option.
   */
  options: ContentScriptActivationOptions & { injectOnClick: false },
): (tab: Tab) => Promise<void>;
/**
 * Sets up the content script activation system in the service worker.
 */
export function setupContentScriptActivation(
  /**
   * Options for the content script activation setup. If a string or array of
   * strings is provided, it will be treated as the `inject.scripts` option.
   */
  options: string | string[] | ContentScriptActivationOptions,
): void | ((tab: Tab) => Promise<void>) {
  // options shorthand
  const resolvedOptions =
    typeof options === "string" || Array.isArray(options)
      ? { inject: { scripts: options } }
      : options;

  const { filterTab, inject, scriptId, injectOnClick } = resolvedOptions;

  async function activate(tab: Tab) {
    // check if it should run in tab
    if (!tab.id) return;
    const tabId = tab.id;
    if (filterTab && !filterTab(tab)) return;

    // activate extension
    const activationContext: RequestActivationContext = { tab, tabId };
    const shouldInject = !(await activateContentScript(
      activationContext,
      scriptId,
    ));

    // exit if activation succeeded
    if (!shouldInject) return;

    // injection shorthand
    const resolvedInject =
      typeof inject === "string" || Array.isArray(inject)
        ? { scripts: inject }
        : inject;

    // before injection
    const { beforeInjection, scripts, styles, afterInjection } = resolvedInject;
    const injectionContext = { tab, tabId };
    await beforeInjection?.(injectionContext);

    // injection
    const injectionPromises = [];
    if (scripts) {
      const allScriptInjections = Array.isArray(scripts) ? scripts : [scripts];
      const stringScripts: string[] = [];
      const allScripts: ScriptInjection[] = [];
      allScriptInjections.forEach((script) => {
        if (typeof script === "string") return stringScripts.push(script);
        allScripts.push(script);
      });
      if (stringScripts.length > 0) allScripts.push({ files: stringScripts });
      injectionPromises.push(
        ...allScripts.map((script) =>
          browser.scripting.executeScript({ target: { tabId }, ...script }),
        ),
      );
    }
    if (styles) {
      const allStyleInjections = Array.isArray(styles) ? styles : [styles];
      const stringStyles: string[] = [];
      const allStyles: CSSInjection[] = [];
      allStyleInjections.forEach((style) => {
        if (typeof style === "string") return stringStyles.push(style);
        allStyles.push(style);
      });
      if (stringStyles.length > 0) allStyles.push({ files: stringStyles });
      injectionPromises.push(
        ...allStyles.map((style) =>
          browser.scripting.insertCSS({ target: { tabId }, ...style }),
        ),
      );
    }
    await Promise.all(injectionPromises);

    // after injection
    await afterInjection?.(injectionContext);

    // initial activation
    await activateContentScript(activationContext, scriptId);
  }

  if (injectOnClick) browser.action.onClicked.addListener(activate);
  else return activate;
}
