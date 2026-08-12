/**
 * Registers sample users then assigns roles via the inventory API.
 * Requires API at http://localhost:4000/api/v1
 *
 * Usage: node scripts/seed-sample-users.js
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:4000/api/v1";

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
    role: "Employee",
    username: "Sample Employee",
    email: "employee.sample@dict.gov.ph",
    position: "Staff",
    designation: "End User",
    project: "Office Inventory",
  },
];

async function registerUser(user) {
  const payload = {
    username: user.username,
    email: user.email,
    project: user.project,
    designation: user.designation,
    password: SAMPLE_PASSWORD,
    position: user.position,
  };
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function findUserByEmail(email) {
  const res = await fetch(`${BASE_URL}/users`);
  if (!res.ok) throw new Error(`GET /users failed (${res.status})`);
  const users = await res.json();
  const list = Array.isArray(users) ? users : users?.data || [];
  return list.find(
    (u) =>
      (u.email || "").toLowerCase() === email.toLowerCase() ||
      u.username === SAMPLE_USERS.find((s) => s.email === email)?.username
  );
}

async function assignRole(userDoc, role) {
  // Employee stays without management role (or set explicitly)
  const nextRole = role === "Employee" ? "" : role;
  const updated = { ...userDoc, role: nextRole };
  const res = await fetch(`${BASE_URL}/users/${userDoc._id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updated),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log(`Seeding sample users against ${BASE_URL}`);
  console.log(`Shared password: ${SAMPLE_PASSWORD}\n`);

  for (const user of SAMPLE_USERS) {
    process.stdout.write(`[${user.role}] ${user.email} ... `);
    try {
      const reg = await registerUser(user);
      if (!reg.ok && reg.status !== 400 && reg.status !== 409) {
        // 400/409 often means already exists
        console.log(`register failed (${reg.status}): ${reg.body.message || ""}`);
      } else if (reg.ok) {
        process.stdout.write("registered, ");
      } else {
        process.stdout.write("exists, ");
      }

      const found = await findUserByEmail(user.email);
      if (!found) {
        console.log("NOT FOUND after register — skip role");
        continue;
      }
      const roleRes = await assignRole(found, user.role);
      if (roleRes.ok) {
        console.log(`role -> ${user.role === "Employee" ? "(none/staff)" : user.role}`);
      } else {
        console.log(`role update failed (${roleRes.status})`);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  console.log("\nDone. Use any sample email + Dict@2026 on the login page.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
