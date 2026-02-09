import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react';
import { z } from 'zod';

// Keep the catalog tiny on purpose. We can expand later.
export const budgetCatalog = defineCatalog(schema, {
  components: {
    Page: {
      description: 'Root page wrapper',
      props: z.object({ title: z.string().optional() }).default({}),
    },
    Section: {
      description: 'Section with title',
      props: z.object({ title: z.string() }),
    },
    Card: {
      description: 'Card container',
      props: z.object({ title: z.string().optional() }).default({}),
    },
    Metric: {
      description: 'Label + value metric',
      props: z.object({
        label: z.string(),
        value: z.string(),
        tone: z.enum(['neutral', 'good', 'warn', 'bad']).optional(),
      }),
    },
    Alert: {
      description: 'Alert message',
      props: z.object({
        tone: z.enum(['info', 'good', 'warn', 'bad']).default('info'),
        title: z.string().optional(),
        message: z.string(),
      }),
    },
    List: {
      description: 'Bulleted list',
      props: z.object({
        title: z.string().optional(),
        items: z.array(z.string()),
      }),
    },
    Divider: {
      description: 'Horizontal divider',
      props: z.object({}).default({}),
    },
  },
  actions: {
    refresh: { description: 'Refresh data' },
  },
});

export type BudgetSpec = unknown;
