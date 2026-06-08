import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import type { TransitionBeforeSwapEvent } from "astro:transitions/client";

gsap.registerPlugin(SplitText);

const PHRASE_SELECTOR = "[data-frame-phrase]";
const INCOMING_PHRASE_ATTRIBUTE = "data-frame-phrase-incoming";

const REVEAL_ANIMATION = {
  fromYPercent: -100,
  duration: 0.65,
  stagger: 0.035,
  ease: "power3.out",
};

const EXIT_ANIMATION = {
  toYPercent: 100,
  duration: 0.45,
  stagger: 0.025,
  ease: "power2.in",
};

type Teardown = () => void;

let teardown: Teardown | undefined;
let pendingViewTransition: Promise<unknown> | undefined;
let initializationId = 0;

function findPhrase(root: ParentNode = document) {
  return root.querySelector<HTMLElement>(PHRASE_SELECTOR);
}

function getPhraseText(phrase: HTMLElement) {
  return phrase.getAttribute("aria-label") ?? phrase.textContent?.trim();
}

function markPhraseReady(phrase: HTMLElement) {
  phrase.dataset.framePhraseReady = "";
}

function replacePhraseText(phrase: HTMLElement, text: string) {
  phrase.textContent = text;
  phrase.removeAttribute(INCOMING_PHRASE_ATTRIBUTE);
}

function splitPhrase(phrase: HTMLElement) {
  const split = SplitText.create(phrase, {
    type: "words,chars",
    mask: "chars",
    wordsClass: "frame-phrase-word",
    charsClass: "frame-phrase-char",
    tag: "span",
  });

  gsap.set(split.masks, {
    display: "inline-block",
    overflow: "clip",
    verticalAlign: "bottom",
  });

  return split;
}

function createRevealTimeline(phrase: HTMLElement) {
  const split = splitPhrase(phrase);

  return gsap.timeline().fromTo(
    split.chars,
    { yPercent: REVEAL_ANIMATION.fromYPercent },
    {
      yPercent: 0,
      duration: REVEAL_ANIMATION.duration,
      stagger: REVEAL_ANIMATION.stagger,
      ease: REVEAL_ANIMATION.ease,
    },
  );
}

function createReplacementTimeline(
  phrase: HTMLElement,
  incomingText: string,
) {
  const outgoingSplit = splitPhrase(phrase);

  return gsap
    .timeline()
    .to(outgoingSplit.chars, {
      yPercent: EXIT_ANIMATION.toYPercent,
      duration: EXIT_ANIMATION.duration,
      stagger: EXIT_ANIMATION.stagger,
      ease: EXIT_ANIMATION.ease,
    })
    .call(() => {
      outgoingSplit.revert();
      replacePhraseText(phrase, incomingText);
      createRevealTimeline(phrase);
    });
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function setupFramePhrase(): Teardown | undefined {
  const phrase = findPhrase();

  if (!phrase) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const incomingPhrase = phrase.getAttribute(INCOMING_PHRASE_ATTRIBUTE);
  const context = gsap.context(() => {
    if (reducedMotion.matches) {
      if (incomingPhrase) {
        replacePhraseText(phrase, incomingPhrase);
      }

      markPhraseReady(phrase);
      return;
    }

    const timeline = incomingPhrase
      ? createReplacementTimeline(phrase, incomingPhrase)
      : createRevealTimeline(phrase);

    markPhraseReady(phrase);

    return () => timeline.kill();
  }, phrase);

  return () => {
    context.revert();
    delete phrase.dataset.framePhraseReady;
  };
}

function stopCurrentAnimation() {
  teardown?.();
  teardown = undefined;
}

async function initializeFramePhrase() {
  const currentInitializationId = ++initializationId;
  const viewTransition = pendingViewTransition;
  pendingViewTransition = undefined;

  stopCurrentAnimation();

  await viewTransition?.catch(() => undefined);

  if (currentInitializationId !== initializationId) return;

  if (viewTransition) {
    await waitForPaint();
  }

  if (currentInitializationId !== initializationId) return;

  teardown = setupFramePhrase();
}

function prepareIncomingPhrase(event: TransitionBeforeSwapEvent) {
  const outgoingPhrase = findPhrase();
  const incomingPhrase = findPhrase(event.newDocument);
  const outgoingText = outgoingPhrase && getPhraseText(outgoingPhrase);
  const incomingText = incomingPhrase?.textContent?.trim();

  if (!outgoingText || !incomingPhrase || !incomingText) return;

  incomingPhrase.setAttribute(INCOMING_PHRASE_ATTRIBUTE, incomingText);
  incomingPhrase.textContent = outgoingText;
  markPhraseReady(incomingPhrase);
}

function handleBeforeSwap(event: TransitionBeforeSwapEvent) {
  initializationId += 1;
  pendingViewTransition = event.viewTransition.finished;

  prepareIncomingPhrase(event);
  stopCurrentAnimation();
}

document.addEventListener("astro:page-load", initializeFramePhrase);
document.addEventListener("astro:before-swap", handleBeforeSwap);
