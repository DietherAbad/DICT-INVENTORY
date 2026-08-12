import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const tabs = [
  { id: "employee", label: "Employee Guide", hint: "RIS, transfer, tracking" },
  { id: "inventory", label: "Stock & Property", hint: "Supply, equipment, ICT, furniture" },
  { id: "settings", label: "Settings", hint: "Admin setup" },
  { id: "users", label: "Users", hint: "Accounts and access" },
];

const modules = [
  {
    title: "Supplies",
    tag: "RIS",
    tone: "emerald",
    simple: "Request office supplies using cart and checkout.",
    actions: ["Add to cart", "Checkout", "Track RIS"],
  },
  {
    title: "Equipment",
    tag: "Property",
    tone: "amber",
    simple: "View, issue, transfer, return, or dispose equipment.",
    actions: ["Add stock", "View item", "Transfer"],
  },
  {
    title: "ICT",
    tag: "Devices",
    tone: "sky",
    simple: "Track laptops, desktops, printers, and other ICT items.",
    actions: ["Add stock", "Specs", "Transfer"],
  },
  {
    title: "Furniture",
    tag: "Fixtures",
    tone: "violet",
    simple: "Track chairs, tables, cabinets, and fixtures.",
    actions: ["Add stock", "View holder", "Transfer"],
  },
];

const toneClass = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
  slate: "border-slate-200 bg-slate-50 text-slate-900",
};

const panelTone = {
  emerald: "border-emerald-200 bg-emerald-50/70",
  amber: "border-amber-200 bg-amber-50/70",
  sky: "border-sky-200 bg-sky-50/70",
  violet: "border-violet-200 bg-violet-50/70",
  slate: "border-slate-200 bg-white",
};

const iconTone = {
  emerald: "bg-emerald-600 text-white",
  amber: "bg-amber-500 text-white",
  sky: "bg-sky-600 text-white",
  violet: "bg-violet-600 text-white",
  slate: "bg-slate-800 text-white",
};

const Section = ({ id, title, note, children }) => (
  <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          Manual
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-slate-950 sm:text-xl">{title}</h2>
      </div>
      {note ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
          {note}
        </span>
      ) : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const MiniStep = ({ index, title, text, tone = "slate" }) => (
  <li className={`rounded-xl border p-3 ${panelTone[tone] || panelTone.slate}`}>
    <div className="flex items-start gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${iconTone[tone] || iconTone.slate}`}>
        {index}
      </span>
      <div>
        <p className="text-sm font-bold text-slate-950">{title}</p>
        {text ? <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p> : null}
      </div>
    </div>
  </li>
);

const Flow = ({ steps, tone = "slate" }) => (
  <ol className="grid gap-3 md:grid-cols-4">
    {steps.map((step, index) => (
      <MiniStep
        key={`${step.title}-${index}`}
        index={index + 1}
        title={step.title}
        text={step.text}
        tone={tone}
      />
    ))}
  </ol>
);

const ModuleCard = ({ module }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${toneClass[module.tone]}`}>
          {module.tag}
        </span>
        <h3 className="mt-3 text-base font-extrabold text-slate-950">{module.title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">{module.simple}</p>
      </div>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${iconTone[module.tone]}`}>
        {module.title.slice(0, 2).toUpperCase()}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {module.actions.map((action) => (
        <span key={action} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
          {action}
        </span>
      ))}
    </div>
  </div>
);

const SimpleScreen = ({ title, rows, button }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white shadow-sm">
    <div className="flex items-center justify-between border-b border-white/10 pb-2">
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
        Sample screen
      </span>
    </div>
    <p className="mt-3 text-sm font-bold">{title}</p>
    <div className="mt-3 space-y-2">
      {rows.map((row, index) => (
        <div key={`${row}-${index}`} className="flex items-center justify-between rounded-xl bg-white/8 px-3 py-2">
          <span className="text-xs text-white/75">{row}</span>
          <span className="h-2 w-14 rounded-full bg-white/20" />
        </div>
      ))}
    </div>
    {button ? (
      <div className="mt-3 rounded-xl bg-white px-3 py-2 text-center text-xs font-bold text-slate-950">
        {button}
      </div>
    ) : null}
  </div>
);

const RisTemplate = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
    <div className="border-b border-slate-200 bg-slate-50 p-4 text-center">
      <p className="text-[11px] font-semibold text-slate-500">DICT REGIONAL OFFICE 02</p>
      <p className="mt-1 text-lg font-black tracking-wide text-slate-950">
        REQUISITION AND ISSUE SLIP
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-500">RIS-01</p>
    </div>
    <div className="grid border-b border-slate-200 text-xs sm:grid-cols-2">
      <div className="border-b border-slate-200 p-3 sm:border-b-0 sm:border-r">
        <span className="font-bold text-slate-500">Fund Cluster:</span> eLGU
      </div>
      <div className="p-3">
        <span className="font-bold text-slate-500">RIS No.:</span> RIS-2026-0001
      </div>
      <div className="border-t border-slate-200 p-3 sm:border-r">
        <span className="font-bold text-slate-500">Division:</span> Your Office
      </div>
      <div className="border-t border-slate-200 p-3">
        <span className="font-bold text-slate-500">Office:</span> DICT Region 2
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-3 py-2">Stock No.</th>
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2">Qty.</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Issued</th>
            <th className="px-3 py-2">Remarks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[
            ["OS-001", "Pcs", "3", "Bond paper A4", "3", "For office use"],
            ["OS-014", "Box", "1", "Ballpen black", "1", ""],
            ["", "", "", "", "", ""],
          ].map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="px-3 py-2 text-slate-700">
                  {cell || <span className="text-slate-300">Blank</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="border-t border-slate-200 p-3 text-xs">
      <span className="font-bold text-slate-500">Purpose:</span> Office supplies for daily work
    </div>
    <div className="grid border-t border-slate-200 text-center text-xs sm:grid-cols-4">
      {["Requested by", "Approved by", "Issued by", "Received by"].map((label) => (
        <div key={label} className="border-b border-slate-200 p-3 sm:border-b-0 sm:border-r last:sm:border-r-0">
          <div className="mx-auto mt-5 h-px w-24 bg-slate-400" />
          <p className="mt-2 font-bold text-slate-700">{label}</p>
          <p className="mt-1 text-slate-400">Date</p>
        </div>
      ))}
    </div>
  </div>
);

const TrackBoard = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="grid gap-2 sm:grid-cols-5">
      {["For checking", "For approval", "Approved", "To receive", "Received"].map((status, index) => (
        <div key={status} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
            index < 3 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
          }`}>
            {index + 1}
          </span>
          <p className="mt-2 text-[11px] font-bold text-slate-700">{status}</p>
        </div>
      ))}
    </div>
  </div>
);

const LinkButton = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
  >
    {children}
  </Link>
);

function EmployeeGuide() {
  return (
    <div className="space-y-5">
      <Section id="employee-start" title="Start Here" note="For regular employees">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-extrabold text-slate-950">Most used tasks</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-3">
                <p className="text-sm font-bold text-slate-950">Request supplies</p>
                <p className="mt-1 text-xs text-slate-600">Use cart, then checkout.</p>
              </div>
              <div className="rounded-xl bg-white p-3">
                <p className="text-sm font-bold text-slate-950">Transfer item</p>
                <p className="mt-1 text-xs text-slate-600">Open item, submit transfer.</p>
              </div>
              <div className="rounded-xl bg-white p-3">
                <p className="text-sm font-bold text-slate-950">Track status</p>
                <p className="mt-1 text-xs text-slate-600">Use Office Dashboard.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton to="/officedashboard">Open Office Dashboard</LinkButton>
              <LinkButton to="/stocktableofficesupply">Request Supplies</LinkButton>
              <LinkButton to="/myinventory">My Inventory</LinkButton>
            </div>
          </div>
          <SimpleScreen
            title="Office Dashboard"
            rows={["Latest Requests & Transfers", "My Inventory", "Status filters"]}
            button="View request"
          />
        </div>
      </Section>

      <Section id="employee-overview" title="System Overview" note="Simple map">
        <div className="grid gap-3 md:grid-cols-4">
          {modules.map((module) => (
            <ModuleCard key={module.title} module={module} />
          ))}
        </div>
      </Section>

      <Section id="employee-cart" title="Add to Cart and Checkout" note="Supplies">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Flow
            tone="emerald"
            steps={[
              { title: "Open supplies", text: "Go to Office Supplies." },
              { title: "Add to cart", text: "Pick item and quantity." },
              { title: "View cart", text: "Check items and total units." },
              { title: "Checkout", text: "Submit the RIS request." },
            ]}
          />
          <SimpleScreen
            title="Supply cart"
            rows={["Bond paper A4 x 3", "Ballpen black x 1", "Recipient: You"]}
            button="Proceed to Checkout"
          />
        </div>
      </Section>

      <Section id="employee-ris" title="RIS Workflow" note="Requisition and Issue Slip">
        <div className="space-y-4">
          <TrackBoard />
          <Flow
            tone="sky"
            steps={[
              { title: "For checking", text: "Inventory checks your request." },
              { title: "For approval", text: "Approver reviews it." },
              { title: "To receive", text: "Approved supplies are ready." },
              { title: "Received", text: "You confirm receipt." },
            ]}
          />
        </div>
      </Section>

      <Section id="employee-ris-template" title="RIS Template" note="Print view sample">
        <RisTemplate />
      </Section>

      <Section id="employee-transfer" title="Transfer Equipment" note="Equipment, ICT, furniture">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Flow
            tone="amber"
            steps={[
              { title: "Open item", text: "Go to My Inventory or item table." },
              { title: "Choose transfer", text: "Click Transfer / Disposal." },
              { title: "Pick receiver", text: "DICT user or other agency." },
              { title: "Track", text: "Watch status in Office Dashboard." },
            ]}
          />
          <SimpleScreen
            title="Transfer form"
            rows={["Transfer to DICT user", "Reason / remarks", "Status: For Transfer"]}
            button="Submit transfer"
          />
        </div>
      </Section>
    </div>
  );
}

function InventoryGuide() {
  return (
    <div className="space-y-5">
      <Section id="stock-types" title="Supply, Equipment, ICT, Furniture" note="Inventory users">
        <div className="grid gap-3 md:grid-cols-4">
          {modules.map((module) => (
            <ModuleCard key={module.title} module={module} />
          ))}
        </div>
      </Section>

      <Section id="add-stocks" title="How to Add Stocks" note="Short steps">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Flow
            tone="violet"
            steps={[
              { title: "Open Stocks", text: "Choose supply, equipment, ICT, or furniture." },
              { title: "Click Add", text: "Use Add Stock or Purchase form." },
              { title: "Fill details", text: "Name, qty, cost, specs, inclusions." },
              { title: "Save", text: "Check the table after saving." },
            ]}
          />
          <SimpleScreen
            title="Add stock form"
            rows={["Item name", "Quantity", "Specs / inclusions"]}
            button="Save stock"
          />
        </div>
      </Section>

      <Section id="transfer-property" title="How to Transfer Property" note="Same pattern">
        <Flow
          tone="amber"
          steps={[
            { title: "View item", text: "Open equipment, ICT, or furniture record." },
            { title: "Transfer", text: "Choose DICT user or other agency." },
            { title: "Submit", text: "Status becomes For Transfer." },
            { title: "Approve", text: "Approver completes the request." },
          ]}
        />
      </Section>

      <Section id="stock-notes" title="Quick Notes" note="Keep data clean">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Use clear names</p>
            <p className="mt-1 text-xs text-slate-600">Avoid duplicate item names when possible.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Add specs</p>
            <p className="mt-1 text-xs text-slate-600">Use specs for equipment, ICT, and furniture.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Check status</p>
            <p className="mt-1 text-xs text-slate-600">Issued, For Transfer, Transferred, Disposed.</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function SettingsGuide() {
  return (
    <div className="space-y-5">
      <Section id="settings-overview" title="Settings Manual" note="Separate tab">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Flow
            tone="slate"
            steps={[
              { title: "Open Settings", text: "Use Settings Dashboard." },
              { title: "Pick page", text: "Workflow, limits, visibility, backup." },
              { title: "Change value", text: "Turn on/off or update number." },
              { title: "Save", text: "Test one request after changes." },
            ]}
          />
          <SimpleScreen
            title="Settings Dashboard"
            rows={["Workflow Settings", "Request Limits", "Role Access"]}
            button="Open setting"
          />
        </div>
      </Section>

      <Section id="settings-list" title="Common Settings" note="Admin only">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Workflow", "Email, signed RIS/PTR, cleanup days."],
            ["Request Limits", "Set request rules and limits."],
            ["Supply Visibility", "Show or hide supply quantities."],
            ["CSV Import", "Import stock records by template."],
            ["Backup", "Create and restore database backup."],
            ["Role Access", "Allow pages per role."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function UsersGuide() {
  return (
    <div className="space-y-5">
      <Section id="users-overview" title="User Manual" note="Accounts">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Flow
            tone="sky"
            steps={[
              { title: "Open Users", text: "Go to Users Dashboard." },
              { title: "Add or review", text: "Check name, office, role, email." },
              { title: "Set access", text: "Use role access when needed." },
              { title: "Export", text: "Download PDF or Excel list." },
            ]}
          />
          <SimpleScreen
            title="Users table"
            rows={["Name and email", "Role", "Office"]}
            button="View user"
          />
        </div>
      </Section>

      <Section id="users-roles" title="Role Guide" note="Simple">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Regular user</p>
            <p className="mt-1 text-xs text-slate-600">Request, receive, transfer, track.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Inventory user</p>
            <p className="mt-1 text-xs text-slate-600">Stocks, issue, transfer, reports.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">Approver</p>
            <p className="mt-1 text-xs text-slate-600">Check, approve, decline, sign.</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

export default function UserManual() {
  const [activeTab, setActiveTab] = useState("employee");

  const activeContent = useMemo(() => {
    if (activeTab === "inventory") return <InventoryGuide />;
    if (activeTab === "settings") return <SettingsGuide />;
    if (activeTab === "users") return <UsersGuide />;
    return <EmployeeGuide />;
  }, [activeTab]);

  const activeTitle = tabs.find((tab) => tab.id === activeTab)?.label || "Employee Guide";

  return (
    <div className="min-h-screen bg-slate-100">
      <section className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-5 sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  <Link to="/" className="text-slate-500 hover:text-slate-950">
                    Dashboard
                  </Link>
                  <span className="mx-2">/</span>
                  User Manual
                </p>
                <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  DICT Inventory Manual
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Simple guide for regular employees first. Request supplies, print RIS, transfer items,
                  and track updates in Office Dashboard.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <LinkButton to="/officedashboard">Office Dashboard</LinkButton>
                  <LinkButton to="/stocktableofficesupply">Supply Request</LinkButton>
                  <LinkButton to="/myinventory">My Inventory</LinkButton>
                </div>
              </div>
              <div className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
                <div className="grid h-full content-center gap-3 sm:grid-cols-2">
                  <SimpleScreen
                    title="Daily work"
                    rows={["RIS request", "Transfer item", "Track status"]}
                    button="Start"
                  />
                  <div className="grid gap-3">
                    {modules.map((module) => (
                      <div key={module.title} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${iconTone[module.tone]}`}>
                          {module.title.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-950">{module.title}</p>
                          <p className="text-[11px] text-slate-500">{module.tag}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="grid gap-2 md:grid-cols-4">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-xl px-4 py-3 text-left transition ${
                      isActive
                        ? "bg-slate-950 text-white shadow-sm"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span className="block text-sm font-extrabold">{tab.label}</span>
                    <span className={`mt-1 block text-[11px] ${isActive ? "text-white/70" : "text-slate-500"}`}>
                      {tab.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-slate-950">{activeTitle}</p>
            <p className="text-xs text-slate-500">Updated May 2026</p>
          </div>

          {activeContent}
        </div>
      </section>
    </div>
  );
}
