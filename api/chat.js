// POST /api/chat  { messages:[{role,content}] } -> { reply, plan? }
// Zero-dep Anthropic Messages API call with a one-tool agent loop.
import { SYSTEM_PROMPT, PLAN_TOOL, computePlan } from "../lib/hedge.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Set ANTHROPIC_API_KEY in Vercel env" });

  let { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: "messages[] required" });
  messages = messages.slice(-24); // bound context

  const call = (msgs) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODEL || "claude-sonnet-5",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        tools: [PLAN_TOOL],
        messages: msgs,
      }),
    }).then((r) => r.json());

  try {
    let msgs = messages, plan = null, reply = "", data;
    for (let hop = 0; hop < 3; hop++) {
      data = await call(msgs);
      if (data.error) return res.status(502).json({ error: data.error.message });
      const toolUse = (data.content || []).find((b) => b.type === "tool_use");
      reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (!toolUse) break;
      plan = computePlan(toolUse.input);
      msgs = [
        ...msgs,
        { role: "assistant", content: data.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(plan) }] },
      ];
    }
    res.status(200).json({ reply, plan });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
