# Hedge Desk — compute-cost hedging agent (Node · Vercel)

The finance conversation GPU businesses never had. A custom-prompted Claude agent +
deterministic hedging calculator, for every actor in the compute market: merchant
neoclouds, marketplace hosts (Vast-style), miner-pivots, AI buyers, GPU-backed
lenders, DC developers.

## Deploy (2 minutes)
```bash
cd architect_agent
npx vercel                       # link/deploy (Vite not needed — zero build)
npx vercel env add ANTHROPIC_API_KEY   # console.anthropic.com -> API keys
npx vercel --prod
```
Optional env: `MODEL` (default `claude-sonnet-5`).

Local dev: `npx vercel dev` → http://localhost:3000

## Architecture (zero dependencies)
```
public/index.html   Apple-minimal landing + chat UI (persona chips)
api/chat.js         serverless agent loop: Claude + compute_hedge_plan tool (max 3 hops)
api/plan.js         deterministic calculator endpoint (no LLM, no key)
lib/hedge.js        SYSTEM_PROMPT (all actors) + computePlan() + tool schema
```
The model runs intake conversationally; when it has the numbers it calls the
`compute_hedge_plan` tool; the deterministic result renders as a plan card. All
math is server-side and auditable — the LLM never invents numbers.

## Why not fork OpenClaw / Hermes?
Both are MIT (fork-friendly), but neither fits "Node on Vercel":
- **OpenClaw** (Node, MIT, ~346k stars) is a *persistent gateway* (Telegram/WhatsApp
  control plane) — architecturally wrong for serverless. It IS the right phase-2
  distribution: run it self-hosted and drop `lib/hedge.js`'s SYSTEM_PROMPT +
  tool in as an AgentSkill so the same desk answers in your Telegram groups.
- **Hermes Agent** (Nous Research, MIT) is Python and centers on a self-improving
  skill loop — wrong runtime here; interesting later for auto-generated
  per-client hedging skills.

## Wire-ups (next)
- Live OCPI/Silicon Data feed -> replace SPOT constant in lib/hedge.js
- True-vol + strike pricing from compute_vol_engine (port or API)
- "Send this plan to the desk" CTA -> your RFQ/auction pipeline (auction.py)
- OpenClaw skill for Telegram distribution (Guild, Architect groups)

## Notes
- Every plan ends with the non-advice disclaimer; venue routing enforces the
  US-person gate (AX = non-US institutional; AIX/CME pending).
- MODEL calls are bounded (last 24 messages, 3 tool hops, 60s function cap).
