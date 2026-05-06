/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Astro configuration for the Caracal documentation site.
 */

import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  output: 'static',
  site: 'https://docs.caracal.run',
  integrations: [
    starlight({
      title: 'Caracal',
      customCss: ['./src/styles/custom.css'],
    }),
  ],
})
