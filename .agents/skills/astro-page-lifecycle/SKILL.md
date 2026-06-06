---
name: astro-page-lifecycle
description: Build and review lifecycle-safe Astro page transitions and client scripts. Use when adding Astro ClientRouter, view transitions, transition directives, page-specific JavaScript, GSAP or ScrollTrigger animations, Three.js scenes, persistent elements, or code that must initialize and clean up across client-side navigation.
---

# Astro Page Lifecycle

Use Astro’s current documentation through the `astro-docs` MCP before relying on remembered APIs.

## Core Rule

Treat each page experience as a disposable instance:

1. Initialize on `astro:page-load`.
2. Return one teardown function from initialization.
3. Run teardown on `astro:before-swap`.
4. Make setup safe when the expected page root is absent.

Bundled Astro module scripts execute only once, while `<ClientRouter />` replaces the page body. Do not rely on a module script running again after navigation.

```ts
let teardown: (() => void) | undefined;

function setupPage() {
  const root = document.querySelector<HTMLElement>("[data-page-experience]");
  if (!root) return;

  const abortController = new AbortController();

  window.addEventListener("pointermove", handlePointerMove, {
    signal: abortController.signal,
  });

  return () => {
    abortController.abort();
  };
}

document.addEventListener("astro:page-load", () => {
  teardown?.();
  teardown = setupPage();
});

document.addEventListener("astro:before-swap", () => {
  teardown?.();
  teardown = undefined;
});
```

Prefer an `AbortController` for DOM listeners. Explicitly disconnect observers and cancel animation resources that do not accept an abort signal.

## Event Selection

- `astro:before-preparation`: loading UI or navigation direction changes.
- `astro:after-preparation`: work after the incoming document is fetched and parsed.
- `astro:before-swap`: tear down outgoing page resources or customize the swap.
- `astro:after-swap`: update the newly swapped DOM before paint, such as restoring a theme.
- `astro:page-load`: initialize page behavior after styles and scripts are ready.

Use literal event names. Astro 6 deprecates the exported transition event constants.

## Transition Design

- Add `<ClientRouter />` once in the shared layout `<head>` only when client-side routing is required.
- Prefer `transition:name` for meaningful shared elements, not every node.
- Use `transition:persist` only for state that must truly survive navigation.
- Do not persist a canvas merely to avoid implementing cleanup.
- Use `transition:animate="none"` or simpler motion where visual continuity matters more than a generic crossfade.
- Preserve forward and backward navigation semantics.
- Respect `prefers-reduced-motion`; provide a readable, immediate state without animation.
- Use `data-astro-reload` when a route cannot safely participate in client navigation.

## GSAP Cleanup

Use the relevant GSAP skills as well as this skill.

- Scope DOM animation with `gsap.context()` and call `context.revert()` in teardown.
- Kill timelines, tweens, delayed calls, and page-owned ScrollTriggers.
- Remove ticker callbacks and input listeners.
- Call `ScrollTrigger.refresh()` after the incoming layout is stable when necessary, not on every frame.
- Never use `ScrollTrigger.killAll()` when persistent or global triggers may exist.

## Three.js Cleanup

- Stop rendering with `renderer.setAnimationLoop(null)` or cancel the owned RAF.
- Dispose geometries, materials, textures, render targets, controls, composers, and the renderer.
- Disconnect `ResizeObserver` and remove pointer, resize, and visibility listeners.
- Remove the canvas if the page instance created it.
- Bound device pixel ratio and pause expensive rendering when hidden or offscreen.
- If a scene uses `transition:persist`, give it a persistent owner that updates page state without recreating the renderer.

## Script Rules

- Prefer bundled module scripts plus lifecycle events.
- Avoid `data-astro-rerun` unless inline re-execution is deliberately required and proven idempotent.
- Never attach page listeners directly at module top level without a lifecycle owner.
- Keep global navigation listeners singular; keep page resources inside the current teardown closure.
- Do not store DOM nodes from the outgoing body in long-lived globals.

## Verification

Test more than a fresh load:

1. Load the page directly.
2. Navigate away and back.
3. Use browser back and forward.
4. Repeat navigation and confirm listeners, canvases, RAF loops, and ScrollTriggers do not multiply.
5. Check reduced motion, mobile resizing, focus, scroll restoration, and console warnings.
6. Run `bun run build`.
