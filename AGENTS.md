# Portfolio 2k26

## Project Intent

Build a story-driven portfolio where each line below becomes a distinct frame with its own visual or interactive experience. Transitions should feel intentional and form one continuous narrative, not a collection of unrelated sections.

Design source of truth: [Portfolio 2k26 in Figma](https://www.figma.com/design/fRzJ9Fc6ZhKtWVGlRczwzg/Portfolio-2k26?node-id=0-1&t=zm4aimelbPDY1OBK-1).

## Narrative

Preserve this copy unless the user explicitly asks to edit it:

1. “I always ask myself“
2. “What should go in a portfolio”
3. “What really matters“
4. “What should i show about me that might be interesting to you“ — show during the transition
5. “Being a developer is so much more than coding stuff“
6. “Being a developer means having a problem“
7. “Finding solutions“
8. “Chosing the one that suits the best“
9. “Understanding other people’s work“
10. “That’s who I am“
11. “Now look at this tree“
12. “Beautiful isn’t it ?“

## Technical Direction

- Use Astro and follow the existing project structure and conventions.
- Consult the installed `astro-docs` MCP for current Astro APIs and recommended patterns.
- Use the project’s `astro-page-lifecycle` skill for page transitions, client-script initialization, and cleanup.
- Use the available GSAP skills for animation, timelines, ScrollTrigger, and performance guidance.
- Use Three.js when a frame genuinely needs 3D, shaders, particles, or WebGL effects; do not add it for simple CSS/GSAP motion.
- Use the installed `threejs-*` skills for fundamentals, geometry, materials, shaders, post-processing, and interaction. Verify version-sensitive APIs against current Three.js docs and pair scene code with `astro-page-lifecycle` cleanup.
- Keep JavaScript client-side only where interaction requires it. Prefer Astro components and progressive enhancement.

## Working Principles

- Think before coding: state assumptions and surface meaningful tradeoffs.
- Keep changes surgical, simple, and directly tied to the requested frame or experience.
- Match the Figma composition closely while preserving responsive behavior and accessibility.
- Give every frame a unique idea, but maintain shared typography, pacing, and transition logic.
- Respect `prefers-reduced-motion` and avoid animations that compromise readability or performance.
- Do not overwrite unrelated work or refactor adjacent code without a clear need.

## Validation

- Use Bun commands because this project has a `bun.lock`.
- Run `bun run build` after implementation changes.
- For visual work, verify the relevant viewport against Figma and check mobile behavior.
