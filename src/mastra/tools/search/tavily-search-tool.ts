import { createTool } from "@mastra/core/tools";
import { tavily } from "@tavily/core";
import { z } from "zod";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export const tavilyImageSchema = z.object({
  url: z.string(),
  description: z.string().optional(),
});

export const tavilySearchResponseSchema = z.object({
  answer: z.string().optional(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
    }),
  ),
});

export type TavilyImage = z.infer<typeof tavilyImageSchema>;
export type TavilySearchResponse = z.infer<typeof tavilySearchResponseSchema>;

export const tavilySearchOptionsSchema = z
  .object({
    topic: z.enum(["general", "news", "finance"]).optional(),
    maxResults: z.number().min(1).max(10).optional(),
    includeImages: z.boolean().optional(),
  })
  .partial()
  .optional();

export const tavilySearchTool = createTool({
  id: "tavily-search-tool",
  description: `
Searches the internet for recent, factual information.

Use this tool whenever current web information is required.

Examples:
- product prices
- product availability
- reviews
- company information
- news
- comparisons
`,

  inputSchema: z.object({
    query: z.string(),
    options: tavilySearchOptionsSchema.describe(
      "Optional parameters to customize the search behavior.",
    ),
  }),

  outputSchema: tavilySearchResponseSchema.describe(
    "The search results from Tavily, including the answer, query, response time, images, results, favicon, usage, and request ID.",
  ),
  execute: async ({ query, options }) => {
    process.stdout.write(`
        Searching the web for: ${query}\n
        With options: ${JSON.stringify(options, null, 2)}
        \n`);
    const response = await tvly.search(query, {
      searchDepth: "advanced",
      includeAnswer: true,
      ...options,
    });

    return response;
  },
});
