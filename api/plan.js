// POST /api/plan — deterministic calculator, no LLM, no key needed.
import { computePlan } from "../lib/hedge.js";
export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try { res.status(200).json(computePlan(req.body || {})); }
  catch (e) { res.status(400).json({ error: String(e) }); }
}
