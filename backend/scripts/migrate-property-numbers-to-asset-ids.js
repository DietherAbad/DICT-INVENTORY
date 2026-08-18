import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import InventoryOfficeEquipment from "../models/InventoryOfficeEquipment.js";
import InventoryOfficeFurnitureandFixture from "../models/InventoryOfficeFurnitureandFixture.js";
import InventoryOfficeICTEquipment from "../models/InventoryOfficeICTEquipment.js";

const COLLECTIONS = [
  { key: "equipment", model: InventoryOfficeEquipment },
  { key: "furniture", model: InventoryOfficeFurnitureandFixture },
  { key: "ict", model: InventoryOfficeICTEquipment },
];

const APPLY = process.argv.includes("--apply");
const backupArg = process.argv.find((arg) => arg.startsWith("--backup="));
const backupPath = backupArg ? path.resolve(backupArg.slice("--backup=".length)) : null;
const rollbackArg = process.argv.find((arg) => arg.startsWith("--rollback="));
const rollbackPath = rollbackArg
  ? path.resolve(rollbackArg.slice("--rollback=".length))
  : null;

const clean = (value) => String(value ?? "").trim();

const acquiredTime = (doc) => {
  const value = doc?.date_acquired ? new Date(doc.date_acquired).getTime() : Number.NaN;
  return Number.isFinite(value) ? value : null;
};

const objectIdTime = (doc) => {
  try {
    return doc._id.getTimestamp().getTime();
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

export const compareOldestFirst = (left, right) => {
  const leftTime = acquiredTime(left) ?? objectIdTime(left);
  const rightTime = acquiredTime(right) ?? objectIdTime(right);
  if (leftTime !== rightTime) return leftTime - rightTime;

  const leftId = Number(left?.id);
  const rightId = Number(right?.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) {
    return leftId - rightId;
  }
  return String(left?._id || "").localeCompare(String(right?._id || ""));
};

const migrateHistory = (history, propertyNo, assetId, legacyPropertyNumber) => {
  if (!Array.isArray(history)) return history;
  return history.map((entry) => {
    if (!entry?.doc_snapshot || typeof entry.doc_snapshot !== "object") return entry;
    const snapshot = { ...entry.doc_snapshot };
    snapshot.asset_id = legacyPropertyNumber
      ? clean(snapshot.property_no) || assetId
      : clean(snapshot.asset_id) || assetId;
    snapshot.property_no = propertyNo;
    return { ...entry, doc_snapshot: snapshot };
  });
};

export const buildCollectionPlan = (docs, collection) => {
  const sorted = [...docs].sort(compareOldestFirst);
  const oldPropertyNumbers = sorted.map((doc) => clean(doc.property_no));
  const blanks = oldPropertyNumbers.filter((value) => !value);
  const duplicates = [
    ...new Set(
      oldPropertyNumbers.filter(
        (value, index) => value && oldPropertyNumbers.indexOf(value) !== index
      )
    ),
  ];

  if (blanks.length || duplicates.length) {
    throw new Error(
      `${collection}: migration blocked (${blanks.length} blank and ${duplicates.length} duplicate property numbers).`
    );
  }
  const plan = sorted.map((doc, index) => {
    const oldPropertyNo = clean(doc.property_no);
    const newPropertyNo = String(index + 1);
    const legacyPropertyNumber = !/^\d+$/.test(oldPropertyNo);
    const currentAssetId = clean(doc.asset_id);
    if (!legacyPropertyNumber && !currentAssetId) {
      throw new Error(
        `${collection}: numeric property number ${oldPropertyNo} on record ${doc._id} has no asset_id to preserve.`
      );
    }
    const newAssetId = legacyPropertyNumber ? oldPropertyNo : currentAssetId;
    return {
      collection,
      _id: doc._id,
      id: doc.id,
      itemName: doc.itemName,
      date_acquired: doc.date_acquired,
      oldPropertyNo,
      oldAssetId: doc.asset_id,
      hadAssetId: Object.prototype.hasOwnProperty.call(doc, "asset_id"),
      newAssetId,
      newPropertyNo,
      legacyPropertyNumber,
      oldHistory: doc.history,
      newHistory: migrateHistory(
        doc.history,
        newPropertyNo,
        newAssetId,
        legacyPropertyNumber
      ),
    };
  });

  const newAssetIds = plan.map((entry) => entry.newAssetId);
  const duplicateAssetIds = [
    ...new Set(
      newAssetIds.filter((value, index) => newAssetIds.indexOf(value) !== index)
    ),
  ];
  if (duplicateAssetIds.length) {
    throw new Error(
      `${collection}: migration would create ${duplicateAssetIds.length} duplicate asset IDs.`
    );
  }
  return plan;
};

const serializePlanEntry = (entry) => ({
  collection: entry.collection,
  _id: String(entry._id),
  id: entry.id,
  itemName: entry.itemName,
  date_acquired: entry.date_acquired,
  oldPropertyNo: entry.oldPropertyNo,
  oldAssetId: entry.oldAssetId,
  hadAssetId: entry.hadAssetId,
  newAssetId: entry.newAssetId,
  newPropertyNo: entry.newPropertyNo,
  oldHistory: entry.oldHistory,
});

const preview = (plan) => {
  const sample = plan.length <= 6 ? plan : [...plan.slice(0, 3), ...plan.slice(-3)];
  return sample.map((entry) => ({
    id: entry.id,
    item: entry.itemName,
    acquired: entry.date_acquired || null,
    property_no: `${entry.oldPropertyNo} -> ${entry.newPropertyNo}`,
    asset_id: `${clean(entry.oldAssetId) || "(blank)"} -> ${entry.newAssetId}`,
  }));
};

const buildBackupFile = async (plans) => {
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const output =
    backupPath ||
    path.resolve("backups", `property-number-migration-${stamp}.json`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(
    output,
    JSON.stringify(
      {
        migration: "property-number-to-asset-id-v1",
        createdAt: new Date().toISOString(),
        database: mongoose.connection.name,
        numbering: "per-collection",
        ordering: "date_acquired, then ObjectId timestamp, then numeric id",
        records: plans.flat().map(serializePlanEntry),
      },
      null,
      2
    ),
    "utf8"
  );
  return output;
};

const applyCollectionPlan = async (model, plan, migrationToken, session) => {
  if (!plan.length) return;

  const temporary = plan.map((entry, index) => ({
    updateOne: {
      filter: { _id: entry._id, property_no: entry.oldPropertyNo },
      update: {
        $set: {
          asset_id: `__property_migration__${migrationToken}__${index}`,
          property_no: `__property_migration__${migrationToken}__${index}`,
        },
      },
    },
  }));
  const staged = await model.bulkWrite(temporary, { ordered: true, session });
  if (staged.matchedCount !== plan.length) {
    throw new Error(
      `${model.modelName}: expected ${plan.length} records during staging, matched ${staged.matchedCount}. Data changed after the dry-run.`
    );
  }

  const finalUpdates = plan.map((entry) => ({
    updateOne: {
      filter: { _id: entry._id },
      update: {
        $set: {
          asset_id: entry.newAssetId,
          property_no: entry.newPropertyNo,
          history: entry.newHistory,
        },
        $inc: { __v: 1 },
      },
    },
  }));
  const updated = await model.bulkWrite(finalUpdates, { ordered: true, session });
  if (updated.matchedCount !== plan.length) {
    throw new Error(
      `${model.modelName}: expected ${plan.length} final records, matched ${updated.matchedCount}.`
    );
  }
};

const verifyCollection = async (model, plan, session) => {
  const docs = await model
    .find({ _id: { $in: plan.map((entry) => entry._id) } })
    .select("property_no asset_id")
    .session(session)
    .lean();
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const invalid = plan.filter((entry) => {
    const doc = byId.get(String(entry._id));
    return (
      clean(doc?.property_no) !== entry.newPropertyNo ||
      clean(doc?.asset_id) !== entry.newAssetId
    );
  });
  if (invalid.length) {
    throw new Error(`${model.modelName}: verification failed for ${invalid.length} records.`);
  }
};

const rollback = async () => {
  const raw = JSON.parse(await fs.readFile(rollbackPath, "utf8"));
  if (raw?.migration !== "property-number-to-asset-id-v1" || !Array.isArray(raw.records)) {
    throw new Error("The rollback file is not a valid property-number migration manifest.");
  }
  if (raw.database && raw.database !== mongoose.connection.name) {
    throw new Error(
      `Rollback database mismatch: manifest is for ${raw.database}, connected to ${mongoose.connection.name}.`
    );
  }

  const byCollection = new Map(COLLECTIONS.map((item) => [item.key, item.model]));
  const session = await mongoose.startSession();
  const token = new mongoose.Types.ObjectId().toString();
  try {
    await session.withTransaction(async () => {
      for (const [key, model] of byCollection) {
        const records = raw.records.filter((record) => record.collection === key);
        if (!records.length) continue;
        const ids = records.map((record) => new mongoose.Types.ObjectId(record._id));
        const existingCount = await model.countDocuments({ _id: { $in: ids } }).session(session);
        if (existingCount !== records.length) {
          throw new Error(
            `${model.modelName}: rollback expected ${records.length} records, found ${existingCount}.`
          );
        }

        await model.bulkWrite(
          records.map((record, index) => ({
            updateOne: {
              filter: { _id: ids[index] },
              update: { $set: { asset_id: `__property_rollback__${token}__${index}` } },
            },
          })),
          { ordered: true, session }
        );

        await model.bulkWrite(
          records.map((record, index) => {
            const set = {
              property_no: record.oldPropertyNo,
              history: record.oldHistory || [],
            };
            if (record.hadAssetId) set.asset_id = record.oldAssetId;
            const update = { $set: set, $inc: { __v: 1 } };
            if (!record.hadAssetId) update.$unset = { asset_id: "" };
            return { updateOne: { filter: { _id: ids[index] }, update } };
          }),
          { ordered: true, session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
  console.log(`Rollback complete using ${rollbackPath}.`);
};

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured.");
  await mongoose.connect(process.env.MONGO_URI);

  if (rollbackPath) {
    if (APPLY) throw new Error("Use either --apply or --rollback, not both.");
    await rollback();
    return;
  }

  const planned = [];
  for (const { key, model } of COLLECTIONS) {
    const docs = await model
      .find({})
      .select("id itemName property_no asset_id date_acquired history")
      .lean();
    const plan = buildCollectionPlan(docs, key);
    planned.push({ key, model, plan });
    console.log(`\n${key}: ${plan.length} records`);
    console.table(preview(plan));
  }

  const total = planned.reduce((sum, item) => sum + item.plan.length, 0);
  if (!APPLY) {
    console.log(`\nDry-run complete. ${total} records are ready; no database writes were made.`);
    console.log("Run again with --apply after reviewing this preview and taking a full database backup.");
    return;
  }

  const backupFile = await buildBackupFile(planned.map((item) => item.plan));
  console.log(`\nRollback manifest written to ${backupFile}`);

  const session = await mongoose.startSession();
  const migrationToken = new mongoose.Types.ObjectId().toString();
  try {
    await session.withTransaction(async () => {
      for (const { model, plan } of planned) {
        await applyCollectionPlan(model, plan, migrationToken, session);
      }
      for (const { model, plan } of planned) {
        await verifyCollection(model, plan, session);
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(`Migration complete. Updated and verified ${total} records.`);
};

const invokedDirectly = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;
if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
