import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react";
import { z } from "zod";

// Vercel-ish, data-heavy, low-risk component catalog.
// Keep it small and composable.
export const uiCatalog = defineCatalog(schema, {
  components: {
    Page: {
      description: "Page wrapper with optional title/subtitle",
      props: z.object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
      }),
    },
    Section: {
      description: "Section header",
      props: z.object({
        title: z.string(),
        description: z.string().optional(),
      }),
    },
    Card: {
      description: "Card container",
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
      }),
    },
    Callout: {
      description: "Callout/alert box",
      props: z.object({
        tone: z.enum(["info", "good", "warn", "bad"]).default("info"),
        title: z.string().optional(),
        message: z.string(),
      }),
    },
    Badge: {
      description: "Small badge",
      props: z.object({
        tone: z.enum(["neutral", "good", "warn", "bad"]).default("neutral"),
        text: z.string(),
      }),
    },
    MetricRow: {
      description: "Label/value row",
      props: z.object({
        label: z.string(),
        value: z.string(),
        hint: z.string().optional(),
        tone: z.enum(["neutral", "good", "warn", "bad"]).default("neutral"),
      }),
    },
    List: {
      description: "Bulleted list",
      props: z.object({
        title: z.string().optional(),
        items: z.array(z.string()),
      }),
    },
    Divider: {
      description: "Horizontal divider",
      props: z.object({}).default({}),
    },
  },
  actions: {
    refresh: { description: "Refresh data" },
  },
});
