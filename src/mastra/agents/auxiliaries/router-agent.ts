import { Agent } from "@mastra/core/agent";
import { defaultModel } from "../../../constants.ts";

export const routerAgent = new Agent({
    id: "router-agent",
    name: "Router Agent",
    description:
        "A router agent that directs user requests to the appropriate specialized agent based on the content of the request. It receives a series of messages from users and determines which agent is best suited to handle each request.",
    instructions: `You are a router agent that directs user requests to the appropriate specialized agent based on the content of the request. You will receive a series of messages from users, and your task is to determine which agent is best suited to handle each request. You should focus on understanding the user's intent and delegate the request to the correct agent. Your response should be structured in a way that is easy to understand and follow. If the user asks to do something just return `,
    model: defaultModel,
    
});