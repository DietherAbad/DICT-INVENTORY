import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";
import InventoryOfficeEquipment from "../models/InventoryOfficeEquipment.js";
import InventoryOfficeFurnitureandFixture from "../models/InventoryOfficeFurnitureandFixture.js";
import InventoryOfficeICTEquipment from "../models/InventoryOfficeICTEquipment.js";

const models = [
  InventoryOfficeEquipment,
  InventoryOfficeFurnitureandFixture,
  InventoryOfficeICTEquipment,
];
const { EJSON } = mongoose.mongo.BSON;

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured.");
  await mongoose.connect(process.env.MONGO_URI);

  const collections = [];
  for (const model of models) {
    const collection = model.collection;
    const [documents, indexes] = await Promise.all([
      collection.find({}).toArray(),
      collection.indexes(),
    ]);
    collections.push({
      name: collection.collectionName,
      count: documents.length,
      indexes,
      documents,
    });
  }

  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const output = path.resolve("backups", `property-collections-${stamp}.ejson`);
  const temporary = `${output}.tmp`;
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(
    temporary,
    EJSON.stringify(
      {
        format: "DICT-property-collections-ejson-v1",
        database: mongoose.connection.name,
        createdAt: new Date(),
        collections,
      },
      { relaxed: false }
    ),
    "utf8"
  );
  await fs.rename(temporary, output);

  const saved = EJSON.parse(await fs.readFile(output, "utf8"));
  const savedCount = saved.collections.reduce(
    (sum, collection) => sum + collection.documents.length,
    0
  );
  const expectedCount = collections.reduce((sum, collection) => sum + collection.count, 0);
  if (savedCount !== expectedCount) {
    throw new Error(`Backup verification failed: expected ${expectedCount}, found ${savedCount}.`);
  }
  console.log(`Backup written and verified: ${output}`);
  console.log(`Collections: ${collections.length}; documents: ${savedCount}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
