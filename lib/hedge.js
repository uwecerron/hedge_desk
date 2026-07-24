// Hedge Desk — deterministic brain + system prompt. Zero deps.
const SPOT = 2.48;        // OCPI-H100 $/GPU-hr (update from feed)
const HOURS_MO = 720;

export const SYSTEM_PROMPT = `You are Hedge Desk, a compute-markets hedging advisor.
Your users run GPU businesses with NO finance team. Explain like a sharp friend, never like a bank.
Never promise returns. Always show the cost of a hedge next to the risk it removes.

ACTORS you serve (adapt tone and instrument to whichever the user is):
- merchant neocloud / marketplace host (Vast-style): long GPUs, spot revenue, fears price falls
- miner pivoting to AI: hashprice-literate, has power assets, new GPU revenue
- AI startup / inference provider (buyer): short compute, fears price spikes
- GPU-backed lender: collateral value risk, wants borrower hedging + DSCR floors
- data-center developer: wants hedged revenue to lower financing cost

PROCESS, strictly:
1 INTAKE: fleet (chip, count) OR monthly GPU spend; % contracted vs merchant; all-in cost per
  GPU-hr (power+opex+debt); monthly debt service; what they fear (down/up/both/yield); US person?
2 DIAGNOSE: merchant exposure in GPU-hrs and $/mo at index ~$${SPOT}; breakeven; if debt, the
  index price where DSCR < 1. Use the compute_hedge_plan tool for all numbers - never hand-wave.
3 RECOMMEND one primary instrument, simplest that works:
  fears down + debt -> short index futures/forward sized to debt service ("a limit sell you can't miss")
  fears down, no debt -> collar (buy put, fund with call) or partial forward
  buyer fears up -> long futures or 15d/5d call spread on budgeted hours
  wants yield -> 5-15 delta covered CALL SPREAD only, priced off TRUE (~56% desmoothed) vol, never naked
4 SIZE: 25-50% of merchant exposure to start. Never 100% (basis risk; their business IS a long). 1-3mo tenor, roll monthly.
5 VENUE: non-US entity -> AX perp (Architect) today; US -> wait for AIX/CME listings or OTC desk. Disclose cash-settled index basis risk.
6 OUTPUT a one-page plan: exposure, instrument, size, tenor, venue, cost, what-if table, three residual
  risks (basis, margin calls, capped upside). End EVERY plan with: "This is analysis, not investment
  advice. Confirm venue eligibility and legal before trading."
Keep answers short. One question at a time during intake.`;

export function computePlan(x) {
  const gpu = Number(x.gpu_count) || 0;
  const pctM = Math.min(Math.max(Number(x.pct_merchant) || 0, 0), 1);
  const cost = Number(x.all_in_cost) || 0;
  const debt = Number(x.monthly_debt) || 0;
  const fear = x.fear || "down";
  const merchHrs = gpu * HOURS_MO * pctM;
  const margin = SPOT - cost;
  const dscrPrice = debt && merchHrs ? debt / merchHrs + cost : null;

  let instr, why, sizeHrs;
  if (fear === "down" && debt) {
    instr = "SHORT index futures/forward (AX perp; AIX/CME when listed)";
    why = "locks a revenue floor sized to your debt service - the hedge your lender wants to see";
    sizeHrs = Math.min(merchHrs * 0.5, debt / Math.max(margin, 0.01));
  } else if (fear === "down") {
    instr = "COLLAR: buy ~25d put, fund with ~15d call";
    why = "a price floor with little or no premium outlay; you give up the top of the rally";
    sizeHrs = merchHrs * 0.35;
  } else if (fear === "up") {
    instr = "LONG futures or 15d/5d CALL SPREAD on budgeted hours";
    why = "caps your compute bill; the spread version is the cheapest insurance";
    sizeHrs = merchHrs * 0.5;
  } else {
    instr = "5-15 delta COVERED CALL SPREAD (never naked)";
    why = "harvests premium on idle capacity; capped upside give-up; priced off TRUE ~56% vol";
    sizeHrs = merchHrs * 0.25;
  }

  const scen = {};
  for (const mv of [-0.3, -0.15, 0, 0.15, 0.3]) {
    const px = SPOT * (1 + mv);
    const un = (px - cost) * merchHrs;
    let hd;
    if (instr.startsWith("SHORT")) hd = un + (SPOT - px) * sizeHrs;
    else if (instr.startsWith("LONG")) hd = un + (px - SPOT) * sizeHrs;
    else if (instr.startsWith("COLLAR")) hd = un + Math.max(SPOT * 0.93 - px, 0) * sizeHrs - Math.max(px - SPOT * 1.17, 0) * sizeHrs;
    else hd = un + 0.011 * sizeHrs - Math.max(px - SPOT * 1.171, 0) * sizeHrs * 0.6;
    scen[`${mv > 0 ? "+" : ""}${Math.round(mv * 100)}%`] = {
      index: +px.toFixed(2),
      unhedged_pnl_mo: Math.round(un),
      hedged_pnl_mo: Math.round(hd),
    };
  }

  return {
    spot_index: SPOT,
    merchant_exposure: {
      gpu_hrs_mo: Math.round(merchHrs),
      revenue_at_spot_mo: Math.round(merchHrs * SPOT),
      breakeven_price: cost,
      margin_per_hr_now: +margin.toFixed(3),
      dscr_breach_price: dscrPrice ? +dscrPrice.toFixed(2) : null,
    },
    recommendation: {
      instrument: instr,
      rationale: why,
      size_gpu_hrs: Math.round(sizeHrs),
      hedge_ratio: merchHrs ? `${Math.round((sizeHrs / merchHrs) * 100)}%` : "0%",
      tenor: "1-3 months, roll monthly",
      venue: x.us_person
        ? "US person: wait for AIX/CME listings or use an OTC desk (AX perp unavailable)"
        : "AX perp (non-US institutional) today; AIX/CME once listed; else OTC desk",
    },
    what_if_monthly: scen,
    residual_risks: [
      "basis: the index is not exactly your realized price",
      "margin calls on the hedge leg during spikes",
      "opportunity cost: hedged upside is smaller upside",
    ],
    disclaimer: "Analysis, not investment advice. Confirm venue eligibility and legal before trading.",
  };
}

export const PLAN_TOOL = {
  name: "compute_hedge_plan",
  description: "Deterministic hedging calculator. Call once intake is complete.",
  input_schema: {
    type: "object",
    properties: {
      gpu_count: { type: "number", description: "GPUs in fleet (or est. equivalent for buyers)" },
      pct_merchant: { type: "number", description: "0-1 share of capacity NOT under contract (buyers: share of spend unhedged)" },
      all_in_cost: { type: "number", description: "$/GPU-hr all-in breakeven (buyers: budgeted price)" },
      monthly_debt: { type: "number", description: "monthly debt service USD, 0 if none" },
      fear: { type: "string", enum: ["down", "up", "both", "yield"] },
      us_person: { type: "boolean" },
    },
    required: ["gpu_count", "pct_merchant", "all_in_cost", "fear"],
  },
};
