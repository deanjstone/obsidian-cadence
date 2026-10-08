/* The plugin calls window.setInterval during onload; Node has no window. */
if (typeof globalThis.window === "undefined") {
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
}
