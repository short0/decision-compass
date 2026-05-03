import { Router } from "express";
import { db } from "../db.js";
import { decisions, options, outcomes, premortems } from "../../shared/schema.js";
import { and, eq, inArray } from "drizzle-orm";

export const decisionsRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

decisionsRouter.use(requireAuth);

// ─── Decisions ────────────────────────────────────────────────────────────────

decisionsRouter.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(decisions)
    .where(eq(decisions.userId, req.session.userId!))
    .orderBy(decisions.updatedAt);
  res.json(rows.reverse());
});

// Workspace: fetch decision + options + premortems in parallel, then outcomes
decisionsRouter.get("/:id/workspace", async (req, res) => {
  const id = req.params.id;
  const [[d], opts, pms] = await Promise.all([
    db.select().from(decisions).where(eq(decisions.id, id)).limit(1),
    db.select().from(options).where(eq(options.decisionId, id)).orderBy(options.sortOrder),
    db.select().from(premortems).where(eq(premortems.decisionId, id)).orderBy(premortems.sortOrder),
  ]);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const optIds = opts.map((o) => o.id);
  const allOutcomes = optIds.length > 0
    ? await db.select().from(outcomes).where(inArray(outcomes.optionId, optIds)).orderBy(outcomes.sortOrder)
    : [];

  res.json({
    decision: d,
    options: opts.map((o) => ({ ...o, outcomes: allOutcomes.filter((oc) => oc.optionId === o.id) })),
    premortems: pms,
  });
});

decisionsRouter.get("/:id", async (req, res) => {
  const [d] = await db.select().from(decisions).where(eq(decisions.id, req.params.id)).limit(1);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });
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

// Seed: batch-insert everything; parallelize outcomes + premortems inserts
decisionsRouter.post("/seed", async (req, res) => {
  const { title, context, options: optionsData, premortems: premortems_data } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });

  const [d] = await db
    .insert(decisions)
    .values({ title, context: context || null, userId: req.session.userId! })
    .returning();

  const decisionId = d.id;
  const insertedOptions: any[] = [];

  if (optionsData?.length > 0) {
    const optRows = await db
      .insert(options)
      .values(optionsData.map((o: any, i: number) => ({
        decisionId,
        title: o.title,
        description: o.description || null,
        sortOrder: i,
      })))
      .returning();
    insertedOptions.push(...optRows);
  }

  const outcomeValues: any[] = [];
  for (let i = 0; i < (optionsData?.length ?? 0); i++) {
    const opt = optionsData[i];
    const createdOpt = insertedOptions[i];
    if (opt.outcomes?.length > 0) {
      opt.outcomes.forEach((oc: any, j: number) => {
        outcomeValues.push({
          optionId: createdOpt.id,
          description: oc.description,
          probability: String(oc.probability),
          impact: String(oc.impact),
          sortOrder: j,
        });
      });
    }
  }

  await Promise.all([
    outcomeValues.length > 0 ? db.insert(outcomes).values(outcomeValues) : Promise.resolve(),
    premortems_data?.length > 0
      ? db.insert(premortems).values(
          premortems_data.map((pm: any, i: number) => ({
            decisionId,
            reason: pm.reason,
            severity: pm.severity || "moderate",
            frequency: pm.frequency || "possible",
            sortOrder: i,
          }))
        )
      : Promise.resolve(),
  ]);

  res.json({ id: decisionId });
});

// PATCH: combine auth check + update into one query via userId in WHERE
decisionsRouter.patch("/:id", async (req, res) => {
  const allowed = ["title", "context", "status", "chosenOptionId", "reflection", "actualOutcome", "outcomeDate"];
  const updates: any = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  const [d] = await db
    .update(decisions)
    .set(updates)
    .where(and(eq(decisions.id, req.params.id), eq(decisions.userId, req.session.userId!)))
    .returning();
  if (!d) return res.status(404).json({ error: "Not found" });
  res.json(d);
});

// DELETE: parallel auth+opts fetch → parallel child deletes → sequential parent deletes
decisionsRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  const [[existing], opts] = await Promise.all([
    db.select({ userId: decisions.userId }).from(decisions).where(eq(decisions.id, id)).limit(1),
    db.select({ id: options.id }).from(options).where(eq(options.decisionId, id)),
  ]);
  if (!existing || existing.userId !== req.session.userId) {
    return res.status(404).json({ error: "Not found" });
  }
  const optIds = opts.map((o) => o.id);
  await Promise.all([
    db.delete(premortems).where(eq(premortems.decisionId, id)),
    optIds.length > 0 ? db.delete(outcomes).where(inArray(outcomes.optionId, optIds)) : Promise.resolve(),
  ]);
  await db.delete(options).where(eq(options.decisionId, id));
  await db.delete(decisions).where(eq(decisions.id, id));
  res.json({ ok: true });
});

// ─── Options ──────────────────────────────────────────────────────────────────

// GET: parallel auth + options fetch, then outcomes
decisionsRouter.get("/:id/options", async (req, res) => {
  const id = req.params.id;
  const [[d], opts] = await Promise.all([
    db.select({ userId: decisions.userId }).from(decisions).where(eq(decisions.id, id)).limit(1),
    db.select().from(options).where(eq(options.decisionId, id)).orderBy(options.sortOrder),
  ]);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const optIds = opts.map((o) => o.id);
  const allOutcomes = optIds.length > 0
    ? await db.select().from(outcomes).where(inArray(outcomes.optionId, optIds)).orderBy(outcomes.sortOrder)
    : [];

  res.json(opts.map((o) => ({ ...o, outcomes: allOutcomes.filter((oc) => oc.optionId === o.id) })));
});

// POST: lightweight auth (userId only) then insert
decisionsRouter.post("/:id/options", async (req, res) => {
  const [d] = await db
    .select({ userId: decisions.userId })
    .from(decisions)
    .where(eq(decisions.id, req.params.id))
    .limit(1);
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

// PATCH: single JOIN for auth, then update
decisionsRouter.patch("/options/:optionId", async (req, res) => {
  const [row] = await db
    .select({ userId: decisions.userId })
    .from(options)
    .innerJoin(decisions, eq(options.decisionId, decisions.id))
    .where(eq(options.id, req.params.optionId));
  if (!row || row.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const updates: any = {};
  if ("title" in req.body) updates.title = req.body.title;
  if ("description" in req.body) updates.description = req.body.description;
  if ("sort_order" in req.body) updates.sortOrder = req.body.sort_order;
  if ("sortOrder" in req.body) updates.sortOrder = req.body.sortOrder;

  const [updated] = await db.update(options).set(updates).where(eq(options.id, req.params.optionId)).returning();
  res.json(updated);
});

// DELETE: JOIN auth, then parallel child deletes, then option delete
decisionsRouter.delete("/options/:optionId", async (req, res) => {
  const optionId = req.params.optionId;
  const [row] = await db
    .select({ userId: decisions.userId })
    .from(options)
    .innerJoin(decisions, eq(options.decisionId, decisions.id))
    .where(eq(options.id, optionId));
  if (!row || row.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  await Promise.all([
    db.delete(outcomes).where(eq(outcomes.optionId, optionId)),
    db.delete(premortems).where(eq(premortems.optionId, optionId)),
  ]);
  await db.delete(options).where(eq(options.id, optionId));
  res.json({ ok: true });
});

// ─── Outcomes ─────────────────────────────────────────────────────────────────

// POST: JOIN auth across options→decisions, then insert
decisionsRouter.post("/options/:optionId/outcomes", async (req, res) => {
  const [row] = await db
    .select({ userId: decisions.userId })
    .from(options)
    .innerJoin(decisions, eq(options.decisionId, decisions.id))
    .where(eq(options.id, req.params.optionId));
  if (!row || row.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

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

// PATCH: 3-table JOIN for auth (outcomes→options→decisions), then update
decisionsRouter.patch("/outcomes/:outcomeId", async (req, res) => {
  const [row] = await db
    .select({ userId: decisions.userId })
    .from(outcomes)
    .innerJoin(options, eq(outcomes.optionId, options.id))
    .innerJoin(decisions, eq(options.decisionId, decisions.id))
    .where(eq(outcomes.id, req.params.outcomeId));
  if (!row || row.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const updates: any = {};
  if ("description" in req.body) updates.description = req.body.description;
  if ("probability" in req.body) updates.probability = String(req.body.probability);
  if ("impact" in req.body) updates.impact = String(req.body.impact);
  if ("sortOrder" in req.body) updates.sortOrder = req.body.sortOrder;

  const [updated] = await db.update(outcomes).set(updates).where(eq(outcomes.id, req.params.outcomeId)).returning();
  res.json(updated);
});

// DELETE: 3-table JOIN for auth, then delete
decisionsRouter.delete("/outcomes/:outcomeId", async (req, res) => {
  const [row] = await db
    .select({ userId: decisions.userId })
    .from(outcomes)
    .innerJoin(options, eq(outcomes.optionId, options.id))
    .innerJoin(decisions, eq(options.decisionId, decisions.id))
    .where(eq(outcomes.id, req.params.outcomeId));
  if (!row || row.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  await db.delete(outcomes).where(eq(outcomes.id, req.params.outcomeId));
  res.json({ ok: true });
});

// ─── Premortems ───────────────────────────────────────────────────────────────

// GET: parallel auth + premortems fetch
decisionsRouter.get("/:id/premortems", async (req, res) => {
  const id = req.params.id;
  const [[d], rows] = await Promise.all([
    db.select({ userId: decisions.userId }).from(decisions).where(eq(decisions.id, id)).limit(1),
    db.select().from(premortems).where(eq(premortems.decisionId, id)).orderBy(premortems.sortOrder),
  ]);
  if (!d || d.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });
  res.json(rows);
});

// POST: lightweight auth then insert
decisionsRouter.post("/:id/premortems", async (req, res) => {
  const [d] = await db
    .select({ userId: decisions.userId })
    .from(decisions)
    .where(eq(decisions.id, req.params.id))
    .limit(1);
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

// PATCH: JOIN auth (premortems→decisions), then update
decisionsRouter.patch("/premortems/:pmId", async (req, res) => {
  const [row] = await db
    .select({ userId: decisions.userId })
    .from(premortems)
    .innerJoin(decisions, eq(premortems.decisionId, decisions.id))
    .where(eq(premortems.id, req.params.pmId));
  if (!row || row.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  const updates: any = {};
  if ("reason" in req.body) updates.reason = req.body.reason;
  if ("severity" in req.body) updates.severity = req.body.severity;
  if ("frequency" in req.body) updates.frequency = req.body.frequency;
  if ("sortOrder" in req.body) updates.sortOrder = req.body.sortOrder;

  const [updated] = await db.update(premortems).set(updates).where(eq(premortems.id, req.params.pmId)).returning();
  res.json(updated);
});

// DELETE: JOIN auth, then delete
decisionsRouter.delete("/premortems/:pmId", async (req, res) => {
  const [row] = await db
    .select({ userId: decisions.userId })
    .from(premortems)
    .innerJoin(decisions, eq(premortems.decisionId, decisions.id))
    .where(eq(premortems.id, req.params.pmId));
  if (!row || row.userId !== req.session.userId) return res.status(404).json({ error: "Not found" });

  await db.delete(premortems).where(eq(premortems.id, req.params.pmId));
  res.json({ ok: true });
});
