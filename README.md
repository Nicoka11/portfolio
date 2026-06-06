# Portfolio 2k26

A story-driven developer portfolio built as a sequence of distinct visual and interactive frames.

Rather than presenting a conventional collection of projects, the experience explores what being a developer actually means: asking questions, understanding problems, finding possible solutions, choosing deliberately, and building upon other people’s work.

## Narrative

The experience follows this progression:

1. “I always ask myself“
2. “What should go in a portfolio”
3. “What really matters“
4. “What should i show about me that might be interesting to you“
5. “Being a developer is so much more than coding stuff“
6. “Being a developer means having a problem“
7. “Finding solutions“
8. “Chosing the one that suits the best“
9. “Understanding other people’s work“
10. “That’s who I am“
11. “Now look at this tree“
12. “Beautiful isn’t it ?“

Each phrase becomes its own frame with a unique interaction, composition, or transition. Together, the frames should feel like one continuous story rather than separate website sections.

## Creative Direction

- Preserve a strong sense of pacing and discovery.
- Give every frame a distinct visual idea while maintaining a coherent art direction.
- Use transitions as part of the storytelling, not as decoration.
- Keep motion responsive, accessible, and respectful of reduced-motion preferences.
- Follow the [Portfolio 2k26 Figma design](https://www.figma.com/design/fRzJ9Fc6ZhKtWVGlRczwzg/Portfolio-2k26?node-id=0-1&t=zm4aimelbPDY1OBK-1) as the visual source of truth.

## Technical Direction

- **Astro** for structure, rendering, and page transitions.
- **GSAP** for choreographed motion and scroll-driven sequences.
- **Three.js** for experiences that genuinely require 3D, shaders, particles, or WebGL.
- Progressive enhancement and minimal client-side JavaScript where possible.

## Development

Requires Node.js 22.12 or newer and [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

The development server runs at `http://localhost:4321`.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Astro development server |
| `bun run build` | Create a production build in `dist/` |
| `bun run preview` | Preview the production build |
| `bun run astro -- check` | Run Astro diagnostics |
