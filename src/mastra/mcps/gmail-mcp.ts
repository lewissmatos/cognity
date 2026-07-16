import { MCPClient } from "@mastra/mcp";

export const gmailMcpClient = new MCPClient({
  id: "gmail-client",
  servers: {
    gmail: {
      command: "npx",
      args: ["-y", "@pouyanafisi/gmail-mcp"],
      env: {
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
      },
    },
  },
});