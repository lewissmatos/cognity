import { Firecrawl } from "firecrawl";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

type FirecrawlWebResult = {
  title?: string;
  url?: string;
};

export function isFirecrawlWebResult(item: unknown): item is FirecrawlWebResult {
  return (
    !!item &&
    typeof item === "object" &&
    "url" in item &&
    typeof (item as { url?: unknown }).url === "string"
  );
}

export const firecrawlSearch = createTool({
  id: "firecrawl-search",
  description: "Search the web and return top results.",
  inputSchema: z.object({ query: z.string().min(1) }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string().nullable(),
        url: z.string(),
      }),
    ),
  }),
  execute: async ({ query }) => {
    process.stdout.write(
      `${new Date().toISOString()} - Searching the web for query: ${query}\n`,
    );
    const results = await firecrawl.search(query, { limit: 2 });
    
    process.stdout.write(
      `${new Date().toISOString()} - Search completed for query: ${query}\n`,
    );

    return {
      results: (results.web ?? [])
        .map((item) => {
          if (!isFirecrawlWebResult(item)) {
            return null;
          }

          return {
            title: item.title ?? null,
            url: item.url,
          };
        })
        .filter(
          (item): item is { title: string | null; url: string } => item !== null,
        ),
    };
  },
});