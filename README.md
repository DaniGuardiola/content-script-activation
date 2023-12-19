<h1>content-script-activation</h1>

Simpler injection of content scripts in browser extensions. Inject once, activate on click.

```bash
npm i content-script-activation
```

<!-- vscode-markdown-toc -->

- [What this does](#what-this-does)
- [Usage](#usage)
- [Documentation](#documentation)
  - [Filtering tabs](#filtering-tabs)
  - [Executing code before or after injection](#executing-code-before-or-after-injection)
  - [Injecting styles](#injecting-styles)
  - [Customizing script and stylesheet injection](#customizing-script-and-stylesheet-injection)
  - [Injecting multiple scripts and stylesheets](#injecting-multiple-scripts-and-stylesheets)
  - [Scripts shorthands](#scripts-shorthands)
  - [Omitting the activation callback](#omitting-the-activation-callback)
  - [Multiple instances](#multiple-instances)
  - [Manual activation](#manual-activation)
- [Browser support](#browser-support)
- [Features under consideration](#features-under-consideration)

<!-- vscode-markdown-toc-config
	numbering=false
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

## <a name='Whatthisdoes'></a>What this does

When building a browser extension, it is a common pattern to inject a content script when the extension icon is clicked. This is usually done like this:

```ts
browser.action.onClicked.addListener((tab) => {
  browser.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content-script.js"],
  });
});
```

However, the problem is that on every click, the content script is injected again. This can cause trouble depending on how the content script is written. For example, if the content script adds an event listener to the `window` object, it will be added again on every click, leading to unexpected behavior.

This package does things differently:

- The content script is injected only once on the first click.
- The "activation" event is triggered on every click, including the first one.

To illustrate this, consider the following sequence of events:

```
Extension icon clicked
  Content script injected
  Activation event triggered
Extension icon clicked
  Activation event triggered
Extension icon clicked
  Activation event triggered
(...)
```

This model is simpler and lets you think about "activation" as a single event that happens on every click. Script injection is handled for you.

## <a name='Usage'></a>Usage

On the service worker:

```ts
import { setupContentScriptActivation } from "content-script-activation";

setupContentScriptActivation("content-script.js");
```

On the content script:

```ts
import { onActivation } from "content-script-activation";

onActivation(() => {
  // ...
});
```

## <a name='Documentation'></a>Documentation

### <a name='Filteringtabs'></a>Filtering tabs

If you want to inject the content script only on certain tabs, you can pass a filter function to `setupContentScriptActivation`:

```ts
setupContentScriptActivation({
  filterTab: (tab) => tab.url?.startsWith("http"),
  inject: "content-script.js",
});
```

The `tab` object ([`tabs.Tab` type](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab)) is the one passed to the [`browser.action.onClicked.addListener`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action/onClicked) callback, and contains information about the tab where the extension icon was clicked (such as the ID, URL, title, etc).

### <a name='Executingcodebeforeorafterinjection'></a>Executing code before or after injection

If you need to run some code before injection (e.g. preparing a database connection) or after injection (e.g. sending a message to the content script), you can use the `beforeInject` and `afterInject` options:

```ts
setupContentScriptActivation({
  inject: {
    async beforeInjection(context) {
      // ...
    },
    async afterInjection(context) {
      // ...
    },
    scripts: "content-script.js",
  },
});
```

Both functions can be synchronous or asynchronous. They receive a `context` object with information about the tab where the content script is injected.

### <a name='Injectingstyles'></a>Injecting styles

You can inject stylesheets in a similar way to scripts:

```ts
setupContentScriptActivation({
  inject: {
    // ...
    styles: "content-style.css",
  },
});
```

### <a name='Customizingscriptandstylesheetinjection'></a>Customizing script and stylesheet injection

If you need more control over how scripts or stylesheets are injected, you can pass option objects instead of strings:

```ts
setupContentScriptActivation({
  inject: {
    scripts: {
      files: ["content-script.js"],
      injectImmediately: false,
    },
    styles: {
      files: ["content-style.css"],
      origin: "USER",
    },
  },
});
```

The options that can be passed correspond to the options that can be passed to [`browser.scripting.executeScript`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript) and [`browser.scripting.insertCSS`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/insertCSS), except for the `target` option (which is always set to the tab where the extension icon was clicked).

### <a name='Injectingmultiplescriptsandstylesheets'></a>Injecting multiple scripts and stylesheets

You can inject multiple scripts and stylesheets by passing an array of strings or option objects:

```ts
setupContentScriptActivation({
  inject: {
    scripts: ["content-script.js", "content-script-2.js"],
    styles: ["content-style.css", "content-style-2.css"],
  },
});
```

Note that you need to call `onActivation` **from every content script** you want to inject.

### <a name='Scriptsshorthands'></a>Scripts shorthands

For brevity, `setupContentScriptActivation` has two shorthand APIs:

- If you don't need to pass any other options, you can pass the script or scripts to inject directly in string form:

  ```ts
  setupContentScriptActivation("content-script.js");
  ```

- If you need to pass other options, but don't need any of the `inject` options, you can pass the script or scripts to inject directly to `inject`:

  ```ts
  setupContentScriptActivation({
    filterTab: (tab) => tab.url?.startsWith("http"),
    inject: "content-script.js",
  });
  ```

### <a name='Omittingtheactivationcallback'></a>Omitting the activation callback

If you don't need to run any code in your content script on activation (for example, if you only want to make sure that the script and styles are only injected once), you can omit the callback when calling `onActivation`:

```ts
import { onActivation } from "content-script-activation";

onActivation();
```

Note that you still need to call `onActivation` from every content script you want to inject.

### <a name='Multipleinstances'></a>Multiple instances

If you want to use `setupContentScriptActivation` more than once, you **must** pass a unique ID to each instance:

```ts
// service-worker.js
setupContentScriptActivation({
  // ...
  inject: "content-script-1.js",
  scriptId: "content-script-1",
});
setupContentScriptActivation({
  // ...
  inject: "content-script-2.js",
  scriptId: "content-script-2",
});

// content-script-1.js
onActivation(() => {
  // ...
}, "content-script-1");

// content-script-2.js
onActivation(() => {
  // ...
}, "content-script-2");
```

An example use case for this is when you want to inject different scripts on different tabs. In this case, you can use the `filterTab` option to filter the tabs where each script is injected.

### <a name='Manualactivation'></a>Manual activation

By default, the content script is activated when the extension icon is clicked. For advanced use cases, you can pass `false` to the `injectOnClick` option. This will disable the default behavior, and `setupContentScriptActivation` will return an asynchronous function that you can call to activate the content script manually. The function takes a target as an argument, which corresponds to the `target` option of [`browser.scripting.executeScript`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript) ([`scripting.InjectionTarget`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/InjectionTarget)).

```ts
const activate = setupContentScriptActivation({
  inject: "content-script.js",
  injectOnClick: false,
});

// when you want to activate the content script:
await activate({ tabId: myTabId });
```

## <a name='Browsersupport'></a>Browser support

All browsers that support the underlying APIs should be supported. This is the case for Chrome and Firefox, and probably all desktop browsers that support extensions in the first place. Cross-browser API namespace compatibility is achieved through the [`browser-namespace`](https://github.com/DaniGuardiola/browser-namespace) package.

## <a name='Featuresunderconsideration'></a>Features under consideration

- Support `browser.scripting.removeCSS`.
