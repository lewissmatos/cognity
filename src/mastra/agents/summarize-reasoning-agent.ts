import { Agent } from "@mastra/core/agent";
import { defaultModel } from "../../constants.ts";

export const summarizeReasoningAgent = new Agent({
    id: "summarize-reasoning-agent",
    name: "Summarize Reasoning Agent",
    instructions: `You are a reasoning agent that summarizes the reasoning of other agents. You will receive a series of messages from other agents, and your task is to summarize their reasoning in a clear and concise manner. You should focus on the key points and avoid unnecessary details. Your summary should be structured in a way that is easy to understand and follow.`,
    model: defaultModel,
    description:
        "A reasoning agent that summarizes the reasoning of other agents. It receives a series of messages from other agents and summarizes their reasoning in a clear and concise manner.",
});