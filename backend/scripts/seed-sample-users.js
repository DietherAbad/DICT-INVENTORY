import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

dotenv.config();

const SAMPLE_PASSWORD = "Dict@2026";

const SAMPLE_USERS = [
  {
    role: "Super Admin",
    username: "Sample Super Admin",
    email: "superadmin.sample@dict.gov.ph",
    position: "Super Admin",
    designation: "DICT RO2",
    project: "Office Inventory",
  },
  {
    role: "Inventory Admin",
    username: "Sample Inventory Admin",
    email: "inventory.admin.sample@dict.gov.ph",
    position: "Inventory Admin",
    designation: "Property Custodian",
    project: "Office Inventory",
  },
  {
    role: "Regional Director",
    username: "Sample Regional Director",
    email: "rd.sample@dict.gov.ph",
    position: "Regional Director",
    designation: "DICT RO2",
    project: "Office Inventory",
  },
  {
    role: "AFD",
    username: "Sample AFD",
    email: "afd.sample@dict.gov.ph",
    position: "Chief, Admin and Finance",
    designation: "AFD",
    project: "Office Inventory",
  },
  {
    role: "TOD",
    username: "Sample TOD",
    email: "tod.sample@dict.gov.ph",
    position: "Technical Operations",
    designation: "TOD",
    project: "Office Inventory",
  },
  {
    role: "Cagayan Provincial Officer",
    username: "Sample Cagayan PO",
    email: "cagayan.po.sample@dict.gov.ph",
    position: "Cagayan Provincial Officer",
    designation: "Provincial Office",
    project: "Office Inventory",
  },
  {
    role: "Isabela Provincial Officer",
    username: "Sample Isabela PO",
    email: "isabela.po.sample@dict.gov.ph",
    position: "Isabela Provincial Officer",
    designation: "Provincial Office",
    project: "Office Inventory",
  },
  {
    role: "Batanes Provincial Officer",
    username: "Sample Batanes PO",
    email: "batanes.po.sample@dict.gov.ph",
    position: "Batanes Provincial Officer",
    designation: "Provincial Office",
    project: "Office Inventory",
  },
  {
    role: "Nueva Vizcaya Provincial Officer",
    username: "Sample Nueva Vizcaya PO",
    email: "nv.po.sample@dict.gov.ph",
    position: "Nueva Vizcaya Provincial Officer",
    designation: "Provincial Office",
    project: "Office Inventory",
  },
  {
    role: "Quirino Provincial Officer",
    username: "Sample Quirino PO",
    email: "quirino.po.sample@dict.gov.ph",
    position: "Quirino Provincial Officer",
    designation: "Provincial Office",
    project: "Office Inventory",
  },
  {
    role: "employee",
    username: "Sample Employee",
    email: "employee.sample@dict.gov.ph",
    position: "Staff",
    designation: "End User",
    project: "Office Inventory",
  },
];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI missing in backend/.env");
  }

  await mongoose.connect(uri);
  console.log("Connected. Seeding sample users…");
  console.log(`Password for all: ${SAMPLE_PASSWORD}\n`);

  const hash = await bcrypt.hash(SAMPLE_PASSWORD, 10);

  for (const u of SAMPLE_USERS) {
    const email = u.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      existing.username = u.username;
      existing.password = hash;
      existing.role = u.role;
      existing.position = u.position;
      existing.designation = u.designation;
      existing.project = u.project;
      await existing.save();
      console.log(`updated  ${u.role.padEnd(32)} ${email}`);
    } else {
      await User.create({
        username: u.username,
        email,
        password: hash,
        role: u.role,
        position: u.position,
        designation: u.designation,
        project: u.project,
      });
      console.log(`created  ${u.role.padEnd(32)} ${email}`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone. Log in on http://localhost:3000 with any sample email.");
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
