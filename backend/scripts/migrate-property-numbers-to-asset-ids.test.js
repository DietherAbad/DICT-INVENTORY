import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  buildCollectionPlan,
  compareOldestFirst,
} from "./migrate-property-numbers-to-asset-ids.js";

const oid = (hex) => new mongoose.Types.ObjectId(hex);

test("orders by acquisition date, then numeric id", () => {
  const docs = [
    { _id: oid("65a000000000000000000003"), id: 3, date_acquired: "2024-01-01" },
    { _id: oid("65a000000000000000000001"), id: 2, date_acquired: "2023-01-01" },
    { _id: oid("65a000000000000000000002"), id: 1, date_acquired: "2024-01-01" },
  ];
  assert.deepEqual([...docs].sort(compareOldestFirst).map((doc) => doc.id), [2, 1, 3]);
});

test("copies old property numbers into asset IDs and renumbers snapshots", () => {
  const plan = buildCollectionPlan(
    [
      {
        _id: oid("65a000000000000000000002"),
        id: 2,
        property_no: "SE-OE-2022-0000002",
        date_acquired: "2022-01-02",
        history: [{ doc_snapshot: { property_no: "SE-OE-2022-0000002" } }],
      },
      {
        _id: oid("65a000000000000000000001"),
        id: 1,
        property_no: "SE-OE-2022-0000001",
        date_acquired: "2022-01-01",
        history: [],
      },
    ],
    "equipment"
  );

  assert.equal(plan[0].newPropertyNo, "1");
  assert.equal(plan[0].newAssetId, "SE-OE-2022-0000001");
  assert.equal(plan[1].newPropertyNo, "2");
  assert.equal(plan[1].newHistory[0].doc_snapshot.property_no, "2");
  assert.equal(plan[1].newHistory[0].doc_snapshot.asset_id, "SE-OE-2022-0000002");
});

test("preserves an existing asset ID on an already-numeric property record", () => {
  const plan = buildCollectionPlan(
    [
      {
        _id: oid("65a000000000000000000001"),
        id: 1,
        property_no: "1",
        asset_id: "SE-ICT-2026-000001",
        history: [{ doc_snapshot: { property_no: "1", asset_id: "SE-ICT-2026-000001" } }],
      },
    ],
    "ict"
  );
  assert.equal(plan[0].newAssetId, "SE-ICT-2026-000001");
  assert.equal(plan[0].newHistory[0].doc_snapshot.asset_id, "SE-ICT-2026-000001");
});

test("blocks duplicate, blank, and unsafe numeric property numbers", () => {
  const base = { _id: oid("65a000000000000000000001"), id: 1, history: [] };
  assert.throws(() => buildCollectionPlan([{ ...base, property_no: "" }], "ict"));
  assert.throws(() =>
    buildCollectionPlan(
      [
        { ...base, property_no: "SE-ICT-X" },
        { ...base, _id: oid("65a000000000000000000002"), property_no: "SE-ICT-X" },
      ],
      "ict"
    )
  );
  assert.throws(() => buildCollectionPlan([{ ...base, property_no: "1" }], "ict"));
});
