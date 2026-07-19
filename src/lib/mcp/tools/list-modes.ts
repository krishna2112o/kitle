import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_modes",
  title: "List chat modes",
  description:
    "List the assistant modes this app supports (website builder, data analysis, education, chat, content) with their slash commands.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const modes = [
      {
        id: "website",
        command: "/website",
        label: "Website Build",
        description: "Build a polished multi-page React + Vite website",
      },
      {
        id: "data-analysis",
        command: "/data",
        label: "Data Analysis",
        description: "Markdown analysis report with insights and ASCII charts",
      },
      {
        id: "education",
        command: "/learn",
        label: "Educational Chat",
        description: "Teach with clear structure, examples and quizzes",
      },
      {
        id: "chat",
        command: "/chat",
        label: "Normal Chat",
        description: "Conversational assistant",
      },
      {
        id: "content",
        command: "/write",
        label: "Content Creation",
        description: "Articles, posts, captions, emails, scripts",
      },
    ];
    return {
      content: [{ type: "text", text: JSON.stringify(modes, null, 2) }],
      structuredContent: { modes },
    };
  },
});
