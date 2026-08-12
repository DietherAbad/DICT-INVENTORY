// OfficeDashboard.jsx
import React, { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { BASE_URL } from "../utils/config";

export default function OfficeDashboard() {
  const { user } = useContext(AuthContext);

  /* ---------- state ---------- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* small-card totals */
  const [totals, setTotals] = useState({
    supplies: 0,
    equipment: 0,
    furniture: 0,
    ict: 0,
  });

  /* big-card breakdowns */
  const [detail, setDetail] = useState({
    supplies: { inStock: 0, outOfStock: 0, low: 0, disposed: 0 },
    equipment: {
      inStock: 0,
      issued: 0,
      transferred: 0,
      forTransfer: 0,
      forApproval: 0,
      forIssuance: 0,
      issuedTransfer: 0,
    },
    furniture: {
      inStock: 0,
      issued: 0,
      transferred: 0,
      forTransfer: 0,
      forApproval: 0,
      forIssuance: 0,
      issuedTransfer: 0,
    },
    ict: {
      inStock: 0,
      issued: 0,
      transferred: 0,
      forTransfer: 0,
      forApproval: 0,
      forIssuance: 0,
      issuedTransfer: 0,
    },
  });

  /* notification sentences */
  const [notifications, setNotifications] = useState([]);

  /* belongs-to-user helper */
  const belongsToUser = (item, username) => {
    if (item.distributedto !== undefined) return item.distributedto === username;
    const st = (item.status ?? "").trim();
    if (st === "Transferred") return item.transfered_to === username;
    if (st === "For Transfer") return item.issued_to === username;
    if (st === "Issued") return item.issued_to === username;
    return false;
  };

  /* ---------- DATA FETCH ---------- */
  useEffect(() => {
    if (!user) return;
    const username = user.data.username;

    /* main dashboards */
    const dashEndpoints = {
      suppliesMy: `${BASE_URL}/distribute/distributions`,
      suppliesInv: `${BASE_URL}/inventoryofficesupply/inventory`,
      equipment: `${BASE_URL}/inventoryofficeequipment/inventory`,
      furniture: `${BASE_URL}/inventoryofficefurnitureandfixture/inventory`,
      ict: `${BASE_URL}/inventoryofficeICTequipment/inventory`,
    };

    /* sources for notifications */
    const watchUrls = [
      `${BASE_URL}/distribute/distributions`,
      `${BASE_URL}/inventoryofficeequipment/inventory`,
      `${BASE_URL}/inventoryofficefurnitureandfixture/inventory`,
      `${BASE_URL}/inventoryofficeICTequipment/inventory`,
      `${BASE_URL}/inventoryofficemotorandvehicle/inventory`,
    ];

    const fetchAll = async () => {
      try {
        /* ---- dashboard data ---- */
        const dashRes = await Promise.all(
          Object.values(dashEndpoints).map((url) =>
            fetch(url).then((r) => {
              if (!r.ok) throw new Error(`API error (${url}): ${r.statusText}`);
              return r.json();
            })
          )
        );

        const [suppliesMy, suppliesInv, equipAll, furnAll, ictAll] = dashRes;

        /* ---- small cards ---- */
        const dashMap = {
          supplies: suppliesMy,
          equipment: equipAll,
          furniture: furnAll,
          ict: ictAll,
        };
        const newTotals = {};
        Object.entries(dashMap).forEach(
          ([k, arr]) =>
            (newTotals[k] = arr.filter((i) => belongsToUser(i, username)).length)
        );

        /* ---- big cards ---- */
        const newDetail = {
          supplies: { inStock: 0, outOfStock: 0, low: 0, disposed: 0 },
          equipment: {
            inStock: 0,
            issued: 0,
            transferred: 0,
            forTransfer: 0,
            forApproval: 0,
            forIssuance: 0,
            issuedTransfer: 0,
          },
          furniture: {
            inStock: 0,
            issued: 0,
            transferred: 0,
            forTransfer: 0,
            forApproval: 0,
            forIssuance: 0,
            issuedTransfer: 0,
          },
          ict: {
            inStock: 0,
            issued: 0,
            transferred: 0,
            forTransfer: 0,
            forApproval: 0,
            forIssuance: 0,
            issuedTransfer: 0,
          },
        };

        const updateEFIC = (cat, item) => {
          const st = (item.status ?? "").trim();
          const req = (item.requeststatus ?? "").trim();
          if (["In Stock", "Instock"].includes(st)) newDetail[cat].inStock += 1;
          else if (st === "Issued") newDetail[cat].issued += 1;
          else if (st === "Transferred") newDetail[cat].transferred += 1;
          else if (st === "For Transfer") {
            newDetail[cat].forTransfer += 1;
            if (req === "For Approval") newDetail[cat].forApproval += 1;
            else if (req === "For Release") newDetail[cat].forIssuance += 1;
            else if (req === "Issued") newDetail[cat].issuedTransfer += 1;
          }
        };

        suppliesInv.forEach((i) => {
          const st = (i.status ?? "").trim();
          const qty = Number(i.stock_qty ?? 0);
          const disp = Number(i.disposed_qty ?? 0);
          if (st === "Instock") newDetail.supplies.inStock += 1;
          if (st === "Out of stock") newDetail.supplies.outOfStock += 1;
          if (qty > 0 && qty < 10) newDetail.supplies.low += 1;
          newDetail.supplies.disposed += disp;
        });
        equipAll.forEach((i) => updateEFIC("equipment", i));
        furnAll.forEach((i) => updateEFIC("furniture", i));
        ictAll.forEach((i) => updateEFIC("ict", i));

        /* ---- notifications ---- */
        const notifRes = await Promise.all(
          watchUrls.map((url) =>
            fetch(url).then((r) => {
              if (!r.ok) throw new Error(`API error (${url}): ${r.statusText}`);
              return r.json();
            })
          )
        );
        const notifyItems = notifRes
          .flat()
          .filter((it) => {
            const st = (it.status ?? "").trim();
            return st === "Pending" || st === "For Transfer";
          })
          .slice(0, 50);

        let gatepassNotifs = [];
        try {
          const gpRes = await fetch(`${BASE_URL}/gatepass`);
          if (gpRes.ok) {
            const gpData = await gpRes.json();
            const list = Array.isArray(gpData) ? gpData : gpData?.data || [];
            gatepassNotifs = list
              .filter((g) =>
                ["For Approval", "For Release", "Released"].includes(
                  g.requeststatus
                )
              )
              .slice(0, 20)
              .map((g) => ({
                msg: `Gatepass ${g.gatepass_no || g._id} (${g.requester}) is ${g.requeststatus}.`,
                link: `/gatepass/${g._id}`,
                cta: "Open",
              }));
          }
        } catch {
          /* backend may not expose /gatepass yet */
        }

        const notifList =
          notifyItems.length === 0 && gatepassNotifs.length === 0
            ? [
                {
                  msg: "No pending or for-transfer items right now.",
                  link: "/officedashboard",
                  cta: "Refresh",
                },
              ]
            : [
                ...gatepassNotifs,
                ...notifyItems.map((it) => {
                const name =
                  it.itemName ||
                  it.supplyName ||
                  it.classification ||
                  it.item_no ||
                  "Item";
                const qty = it.qty ?? it.quantity ?? 1;
                const st = (it.status ?? "").trim();
                const verb = st === "Pending" ? "is PENDING" : "is FOR TRANSFER";
                return {
                  msg: `${name} (qty ${qty}) ${verb}.`,
                  link: "/request",
                  cta: "View",
                };
              }),
              ];

        setTotals(newTotals);
        setDetail(newDetail);
        setNotifications(notifList);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ---------- gates ---------- */
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg font-medium">Loading inventory…</p>
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );

  /* ---------- render ---------- */
  return (
    <div className="dark:bg-gray-900 min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-center text-3xl md:text-5xl font-extrabold text-gray-800 dark:text-white">
          Region&nbsp;II – Office&nbsp;Inventory&nbsp;Dashboard
        </h1>

        {/* notifications */}
        <NotificationCard notifications={notifications} />

        {/* small summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {[
            { key: "supplies", label: "My Supplies" },
            { key: "equipment", label: "My Equipments" },
            { key: "furniture", label: "My Furniture & Fixtures" },
            { key: "ict", label: "My ICT Equipments" },
          ].map((c) => (
            <div
              key={c.key}
              className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 flex flex-col items-center"
            >
              <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                {totals[c.key]}
              </p>
              <p className="mt-2 font-medium text-gray-600 dark:text-gray-300 text-center">
                {c.label}
              </p>
            </div>
          ))}
        </div>

        {/* big breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-16">
          <BigCard title="Supplies">
            <BreakdownRow label="Item in Stock" value={detail.supplies.inStock} />
            <BreakdownRow label="Item low on Stock" value={detail.supplies.low} />
            <BreakdownRow label="Item out of Stock" value={detail.supplies.outOfStock} />
            <BreakdownRow label="Item Disposed" value={detail.supplies.disposed} />
          </BigCard>

          <BigCard title="Equipment">
            <BreakdownRow label="Item in Stock" value={detail.equipment.inStock} />
            <BreakdownRow label="Item Issued" value={detail.equipment.issued} />
            <BreakdownRow label="Item Transferred" value={detail.equipment.transferred} />
            <BreakdownRow label="Item for Transfer" value={detail.equipment.forTransfer} />
            <BreakdownRow nested label=" • For Approval" value={detail.equipment.forApproval} />
            <BreakdownRow nested label=" • For Issuance" value={detail.equipment.forIssuance} />
          </BigCard>

          <BigCard title="Furniture & Fixture">
            <BreakdownRow label="Item in Stock" value={detail.furniture.inStock} />
            <BreakdownRow label="Item Issued" value={detail.furniture.issued} />
            <BreakdownRow label="Item Transferred" value={detail.furniture.transferred} />
            <BreakdownRow label="Item for Transfer" value={detail.furniture.forTransfer} />
            <BreakdownRow nested label=" • For Approval" value={detail.furniture.forApproval} />
            <BreakdownRow nested label=" • For Issuance" value={detail.furniture.forIssuance} />
          </BigCard>

          <BigCard title="ICT Equipment">
            <BreakdownRow label="Item in Stock" value={detail.ict.inStock} />
            <BreakdownRow label="Item Issued" value={detail.ict.issued} />
            <BreakdownRow label="Item Transferred" value={detail.ict.transferred} />
            <BreakdownRow label="Item for Transfer" value={detail.ict.forTransfer} />
            <BreakdownRow nested label=" • For Approval" value={detail.ict.forApproval} />
            <BreakdownRow nested label=" • For Issuance" value={detail.ict.forIssuance} />
          </BigCard>
        </div>
      </div>
    </div>
  );
}

/* ---------- sub components ---------- */
function BigCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function BreakdownRow({ label, value, nested = false }) {
  return (
    <li
      className={`flex justify-between ${
        nested ? "pl-4" : ""
      } text-gray-700 dark:text-gray-300`}
    >
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}

function NotificationCard({ notifications }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? notifications.slice(0, 5) : notifications.slice(0, 1);

  return (
    <div className="bg-gradient-to-r from-indigo-500 to-blue-500 dark:from-indigo-600 dark:to-purple-600 text-white rounded-lg shadow-xl p-8 mt-12 mb-8">
      <h2 className="text-2xl font-semibold mb-6 flex items-center">
        <svg
          className="w-7 h-7 mr-2 animate-bounce-slow"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        Notifications
      </h2>

      {visible.map((n, idx) => (
        <div
          key={idx}
          className="bg-white bg-opacity-10 backdrop-blur-sm rounded-md p-4 flex justify-between items-center mb-3 last:mb-0"
        >
          <span className="flex-1">{n.msg}</span>
          <Link
            to={n.link}
            className="ml-4 inline-block px-4 py-2 bg-white text-indigo-600 font-semibold rounded-md hover:bg-indigo-100 transition-all"
          >
            {n.cta}
          </Link>
        </div>
      ))}

      {notifications.length > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 text-sm underline hover:text-gray-200 focus:outline-none"
        >
          {expanded ? "Show less" : `Show more (${notifications.length - 1})`}
        </button>
      )}
    </div>
  );
}

/* bounce animation */
const style = document.createElement("style");
style.textContent = `
@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
.animate-bounce-slow {
  animation: bounce-slow 1.8s infinite;
}
`;
document.head.appendChild(style);
