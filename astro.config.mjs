// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Switzer',
      cssVariable: '--font-switzer',
      options: {
        variants: [
          {
            weight: '100 900',
            style: 'normal',
            src: ['./src/assets/fonts/switzer/Switzer-Variable.woff2'],
          },
          {
            weight: '100 900',
            style: 'italic',
            src: ['./src/assets/fonts/switzer/Switzer-VariableItalic.woff2'],
          },
        ],
      },
    },
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
