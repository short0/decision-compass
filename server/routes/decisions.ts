import { Router } from "express";
import { db } from "../db.js";
import { decisions, options, outcomes, premortems } from "../../shared/schema.js";
import { eq, inArray } from "drizzle-orm";

export const decisionsRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

decisionsRouter.use(requireAuth);

decisionsRouter.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(decisions)
    .where(eq(decisions.userId, req.session.userId!))
    .orderBy(decisions.updatedAt);
  res.json(rows.reverse());
});

decisionsRouter.get("/:id/workspace", async (req, res) => {
  const [d] = await db.select().from(decisions).where(eq(decisions.id, req.params.id)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const [opts, pms] = await Promise.all([
    db.select().from(options).where(eq(options.decisionId, req.params.id)).orderBy(options.sortOrder),
    db.select().from(premortems).where(eq(premortems.decisionId, req.params.id)).orderBy(premortems.sortOrder),
  ]);

  const optIds = opts.map((o) => o.id);
  const allOutcomes = optIds.length > 0
    ? await db.select().from(outcomes).where(inArray(outcomes.optionId, optIds)).orderBy(outcomes.sortOrder)
    : [];

  const optionsWithOutcomes = opts.map((o) => ({
    ...o,
    outcomes: allOutcomes.filter((oc) => oc.optionId === o.id),
  }));

  res.json({ decision: d, options: optionsWithOutcomes, premortems: pms });
});

decisionsRouter.get("/:id", async (req, res) => {
  const [d] = await db
    .select()
    .from(decisions)
    .where(eq(decisions.id, req.params.id))
    .limit(1);
  if (!d || d.userId !== req.session.userId) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(d);
});

decisionsRouter.post("/", async (req, res) => {
  const { title, context } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });
  const [d] = await db
    .insert(decisions)
    .values({ title, context: context || null, userId: req.session.userId! })
    .returning();
  res.json(d);
});

decisionsRouter.patch("/:id", async (req, res) => {
  const [existing] = await db.select().from(decisions).where(eq(decisions.id, req.params.id)).limit(1);
  if (!existing || existing.userId !== req.session.userId) {
    return res.status(404).json({ error: "Not found" });
  }
  const allowed = ["title", "context", "status", "chosenOptionId", "reflection", "actualOutcome", "outcomeDate"];
  const updates: any = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  updates.updatedAt = new Date();
  const [d] = await db
    .update(decisions)
    .set(updates)
    .where(eq(decisions.id, req.params.id))
    .returning();
  res.json(d);
});

decisionsRouter.delete("/:id", async (req, res) => {
  const [existing] = await db.select().from(decisions).where(eq(decisions.id, req.params.id)).limit(1);
  if (!existing || existing.userId !== req.session.userId) {
    return res.status(404).json({ error: "Not found" });
  }
  const opts = await db.select({ id: options.id }).from(options).where(eq(options.decisionId, req.params.id));
  const optIds = opts.map((o) => o.id);
  if (optIds.length > 0) {
    await db.delete(outcomes).where(inArray(outcomes.optionId, optIds));
  }
  await db.delete(premortems).where(eq(premortems.decisionId, req.params.id));
  await db.delete(options).where(eq(options.decisionId, req.params.id));
  await db.delete(decisions).where(eq(decisions.id, req.params.id));
  res.json({ ok: true });
});

decisionsRouter.get("/:id/options", async (req, res) => {
  const [d] = await db.select().from(decisions).where(eq(decisions.id, req.params.id)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const opts = await db.select().from(options).where(eq(options.decisionId, req.params.id)).orderBy(options.sortOrder);
  const optIds = opts.map((o) => o.id);
  let allOutcomes: any[] = [];
  if (optIds.length > 0) {
    allOutcomes = await db.select().from(outcomes).where(inArray(outcomes.optionId, optIds)).orderBy(outcomes.sortOrder);
  }
  const result = opts.map((o) => ({
    ...o,
    outcomes: allOutcomes.filter((oc) => oc.optionId === o.id),
  }));
  res.json(result);
});

decisionsRouter.post("/:id/options", async (req, res) => {
  const [d] = await db.select().from(decisions).where(eq(decisions.id, req.params.id)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const { title, description, sort_order } = req.body;
  const [o] = await db
    .insert(options)
    .values({
      decisionId: req.params.id,
      title: title || "New Option",
      description: description || null,
      sortOrder: sort_order ?? 0,
    })
    .returning();
  res.json(o);
});

decisionsRouter.patch("/options/:optionId", async (req, res) => {
  const [o] = await db.select().from(options).where(eq(options.id, req.params.optionId)).limit(1);
  if (!o) return res.status(404).json({ error: "Not found" });
  const [d] = await db.select().from(decisions).where(eq(decisions.id, o.decisionId)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const updates: any = {};
  if ("title" in req.body) updates.title = req.body.title;
  if ("description" in req.body) updates.description = req.body.description;
  if ("sort_order" in req.body) updates.sortOrder = req.body.sort_order;
  if ("sortOrder" in req.body) updates.sortOrder = req.body.sortOrder;

  const [updated] = await db.update(options).set(updates).where(eq(options.id, req.params.optionId)).returning();
  res.json(updated);
});

decisionsRouter.delete("/options/:optionId", async (req, res) => {
  const [o] = await db.select().from(options).where(eq(options.id, req.params.optionId)).limit(1);
  if (!o) return res.status(404).json({ error: "Not found" });
  const [d] = await db.select().from(decisions).where(eq(decisions.id, o.decisionId)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  await db.delete(outcomes).where(eq(outcomes.optionId, req.params.optionId));
  await db.delete(premortems).where(eq(premortems.optionId, req.params.optionId));
  await db.delete(options).where(eq(options.id, req.params.optionId));
  res.json({ ok: true });
});

decisionsRouter.post("/options/:optionId/outcomes", async (req, res) => {
  const [o] = await db.select().from(options).where(eq(options.id, req.params.optionId)).limit(1);
  if (!o) return res.status(404).json({ error: "Not found" });
  const [d] = await db.select().from(decisions).where(eq(decisions.id, o.decisionId)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const { description, probability, impact, sort_order } = req.body;
  const [oc] = await db
    .insert(outcomes)
    .values({
      optionId: req.params.optionId,
      description: description || "New outcome",
      probability: probability != null ? String(probability) : "50",
      impact: impact != null ? String(impact) : "0",
      sortOrder: sort_order ?? 0,
    })
    .returning();
  res.json(oc);
});

decisionsRouter.patch("/outcomes/:outcomeId", async (req, res) => {
  const [oc] = await db.select().from(outcomes).where(eq(outcomes.id, req.params.outcomeId)).limit(1);
  if (!oc) return res.status(404).json({ error: "Not found" });
  const [o] = await db.select().from(options).where(eq(options.id, oc.optionId)).limit(1);
  const [d] = await db.select().from(decisions).where(eq(decisions.id, o.decisionId)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const updates: any = {};
  if ("description" in req.body) updates.description = req.body.description;
  if ("probability" in req.body) updates.probability = String(req.body.probability);
  if ("impact" in req.body) updates.impact = String(req.body.impact);
  if ("sortOrder" in req.body) updates.sortOrder = req.body.sortOrder;

  const [updated] = await db.update(outcomes).set(updates).where(eq(outcomes.id, req.params.outcomeId)).returning();
  res.json(updated);
});

decisionsRouter.delete("/outcomes/:outcomeId", async (req, res) => {
  const [oc] = await db.select().from(outcomes).where(eq(outcomes.id, req.params.outcomeId)).limit(1);
  if (!oc) return res.status(404).json({ error: "Not found" });
  const [o] = await db.select().from(options).where(eq(options.id, oc.optionId)).limit(1);
  const [d] = await db.select().from(decisions).where(eq(decisions.id, o.decisionId)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  await db.delete(outcomes).where(eq(outcomes.id, req.params.outcomeId));
  res.json({ ok: true });
});

decisionsRouter.get("/:id/premortems", async (req, res) => {
  const [d] = await db.select().from(decisions).where(eq(decisions.id, req.params.id)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const rows = await db.select().from(premortems).where(eq(premortems.decisionId, req.params.id)).orderBy(premortems.sortOrder);
  res.json(rows);
});

decisionsRouter.post("/:id/premortems", async (req, res) => {
  const [d] = await db.select().from(decisions).where(eq(decisions.id, req.params.id)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const { reason, severity, frequency, option_id, sort_order } = req.body;
  const [pm] = await db
    .insert(premortems)
    .values({
      decisionId: req.params.id,
      optionId: option_id || null,
      reason: reason || "What could go wrong?",
      severity: severity || "medium",
      frequency: frequency || "occasional",
      sortOrder: sort_order ?? 0,
    })
    .returning();
  res.json(pm);
});

decisionsRouter.patch("/premortems/:pmId", async (req, res) => {
  const [pm] = await db.select().from(premortems).where(eq(premortems.id, req.params.pmId)).limit(1);
  if (!pm) return res.status(404).json({ error: "Not found" });
  const [d] = await db.select().from(decisions).where(eq(decisions.id, pm.decisionId)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const updates: any = {};
  if ("reason" in req.body) updates.reason = req.body.reason;
  if ("severity" in req.body) updates.severity = req.body.severity;
  if ("frequency" in req.body) updates.frequency = req.body.frequency;
  if ("sortOrder" in req.body) updates.sortOrder = req.body.sortOrder;

  const [updated] = await db.update(premortems).set(updates).where(eq(premortems.id, req.params.pmId)).returning();
  res.json(updated);
});

decisionsRouter.delete("/premortems/:pmId", async (req, res) => {
  const [pm] = await db.select().from(premortems).where(eq(premortems.id, req.params.pmId)).limit(1);
  if (!pm) return res.status(404).json({ error: "Not found" });
  const [d] = await db.select().from(decisions).where(eq(decisions.id, pm.decisionId)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  await db.delete(premortems).where(eq(premortems.id, req.params.pmId));
  res.json({ ok: true });
});
