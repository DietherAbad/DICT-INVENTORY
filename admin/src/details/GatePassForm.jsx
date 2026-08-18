import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import DICT from "../assets/DICT.png";
import { gatepassApi, statusBadgeClass } from "../utils/gatepass";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function GatePassForm() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const username = user?.data?.username;
  const role = user?.data?.role || "";

  const [gatepass, setGatepass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [docView, setDocView] = useState("gatepass"); // gatepass | ics | par
  const [guardName, setGuardName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await gatepassApi.get(id);
      setGatepass(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runAction = async (fn) => {
    try {
      setBusy(true);
      setError(null);
      await fn();
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-10">Loading…</div>;
  if (error && !gatepass) {
    return (
      <div className="p-10 text-red-600">
        Error: {error.message}
        <button
          type="button"
          className="block mt-4 text-indigo-600"
          onClick={() => navigate("/gatepass")}
        >
          Back
        </button>
      </div>
    );
  }

  const status = gatepass.requeststatus;
  const items = gatepass.items || [];
  const canApprove =
    status === "For Approval" &&
    (role.includes("AFD") ||
      role.includes("Regional Director") ||
      role.includes("Inventory Admin") ||
      role.includes("Admin"));
  const canRelease =
    status === "For Release" &&
    (role.includes("Inventory Admin") ||
      role.includes("Property") ||
      role.includes("Custodian") ||
      role.includes("Admin") ||
      role.includes("AFD"));
  const canGuard = status === "Released";
  const canReturn = status === "Out" || status === "Released";
  const canDecline =
    status === "For Approval" || status === "For Release" || status === "Draft";
  const isRequester = gatepass.requester === username;

  return (
    <div className="w-full sm:px-6 pt-8 pb-16">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="no-print flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate("/gatepass")}
          className="px-3 py-2 border rounded-md text-sm"
        >
          Back
        </button>
        <span
          className={
            "px-2 py-1 text-sm font-medium rounded-full " +
            statusBadgeClass(status)
          }
        >
          {status}
        </span>
        {error && (
          <span className="text-sm text-red-600">{error.message}</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {["gatepass", "ics", "par"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setDocView(v)}
              className={
                "px-3 py-1.5 rounded text-sm uppercase " +
                (docView === v
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700")
              }
            >
              {v}
            </button>
          ))}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-gray-800 text-white rounded text-sm"
          >
            Print
          </button>
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap gap-2">
        {canApprove && (
          <ActionBtn
            disabled={busy}
            label="Approve"
            onClick={() =>
              runAction(() =>
                gatepassApi.approve(id, { approved_by: username })
              )
            }
          />
        )}
        {canRelease && (
          <ActionBtn
            disabled={busy}
            label="Release"
            onClick={() =>
              runAction(() =>
                gatepassApi.release(id, { released_by: username })
              )
            }
          />
        )}
        {canGuard && (
          <div className="flex gap-2 items-center">
            <input
              value={guardName}
              onChange={(e) => setGuardName(e.target.value)}
              placeholder="Guard on-duty name"
              className="px-3 py-2 border rounded-md text-sm"
            />
            <ActionBtn
              disabled={busy || !guardName.trim()}
              label="Confirm Out"
              onClick={() =>
                runAction(() =>
                  gatepassApi.guard(id, {
                    guard_on_duty: guardName.trim(),
                  })
                )
              }
            />
          </div>
        )}
        {canReturn && (isRequester || canRelease || canApprove) && (
          <ActionBtn
            disabled={busy}
            label="Mark Returned"
            onClick={() => runAction(() => gatepassApi.returnPass(id))}
          />
        )}
        {canDecline && (
          <ActionBtn
            disabled={busy}
            label="Decline"
            danger
            onClick={() =>
              runAction(() =>
                gatepassApi.decline(id, { declined_by: username })
              )
            }
          />
        )}
      </div>

      <div className="bg-white shadow-lg rounded-lg p-6 md:p-10 max-w-4xl mx-auto print:shadow-none">
        <div className="flex items-center gap-4 mb-6">
          <img src={DICT} alt="DICT" className="h-20 w-20 object-contain" />
          <div>
            <p className="text-sm text-gray-600">Regional Office 02</p>
            <p className="text-xs text-gray-500">
              Bagay Rd., San Gabriel, Tuguegarao City, Cagayan
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              {docView === "ics"
                ? "INVENTORY CUSTODIAN SLIP"
                : docView === "par"
                ? "PROPERTY ACKNOWLEDGEMENT RECEIPT"
                : "GATE PASS"}
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-6">
          <Field
            label={docView === "gatepass" ? "Name" : "Entity Name"}
            value={
              docView === "gatepass"
                ? gatepass.requester
                : "DICT Regional Office - 02"
            }
          />
          <Field label="Fund Cluster" value={gatepass.fund_cluster} />
          {docView === "ics" && (
            <Field label="ICS NO." value={gatepass.ics_no || "—"} />
          )}
          {docView === "par" && (
            <Field label="PAR No." value={gatepass.par_no || "—"} />
          )}
          {docView === "gatepass" && (
            <Field label="Gate Pass No." value={gatepass.gatepass_no || "—"} />
          )}
          {gatepass.destination && (
            <Field label="Destination" value={gatepass.destination} />
          )}
        </div>

        <table className="w-full text-sm border border-gray-300 mb-6">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-2 py-2">NO.</th>
              <th className="border px-2 py-2">Unit</th>
              <th className="border px-2 py-2">QTY</th>
              <th className="border px-2 py-2 text-left">Description</th>
              <th className="border px-2 py-2">Property Number</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.inventoryId || idx}>
                <td className="border px-2 py-2 text-center">{idx + 1}</td>
                <td className="border px-2 py-2 text-center">
                  {it.unitofmeasure || "pc"}
                </td>
                <td className="border px-2 py-2 text-center">{it.qty ?? 1}</td>
                <td className="border px-2 py-2">{it.itemName}</td>
                <td className="border px-2 py-2 text-center">
                  {it.property_no || it.serial_no || "—"}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="border px-2 py-4 text-center text-gray-500">
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="text-sm mb-8">
          <strong>Purpose:</strong> {gatepass.purpose}
        </p>

        {docView === "gatepass" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <SignBlock
              title="Released by"
              name={gatepass.released_by}
              date={gatepass.date_released}
            />
            <SignBlock
              title="Approved by"
              name={gatepass.approved_by}
              date={gatepass.date_approved}
            />
            <SignBlock
              title="Guard on-duty"
              name={gatepass.guard_on_duty}
              date={gatepass.date_out}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <SignBlock
              title="Received from"
              name={gatepass.released_by || "Property Custodian"}
              date={gatepass.date_released}
            />
            <SignBlock
              title="Received by"
              name={gatepass.requester}
              date={gatepass.date_released || gatepass.date_approved}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <p>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium text-gray-900">{value || "—"}</span>
    </p>
  );
}

function SignBlock({ title, name, date }) {
  return (
    <div>
      <p className="font-semibold text-gray-800 mb-6">{title}</p>
      <p className="border-b border-gray-400 pb-1 min-h-[1.5rem] font-medium">
        {name || ""}
      </p>
      <p className="text-xs text-gray-500 mt-1">Signature Over Printed Name</p>
      <p className="text-xs text-gray-500 mt-3">Date: {formatDate(date)}</p>
    </div>
  );
}

function ActionBtn({ label, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "px-3 py-2 rounded-md text-sm text-white disabled:opacity-50 " +
        (danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700")
      }
    >
      {label}
    </button>
  );
}
