import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Blog posts collection
 * Each post lives in its own folder: src/content/posts/[slug]/index.md
 * Images can be co-located in the same folder
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      modified: z.coerce.date().optional(),
      featured: image().optional(),
      featuredAlt: z.string().default(''),
      draft: z.boolean().default(false),
    }),
});

/**
 * Static pages collection (now, home, etc.)
 * Simple flat files: src/content/pages/[slug].md
 */
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    modified: z.coerce.date().optional(),
  }),
});

export const collections = { posts, pages };
