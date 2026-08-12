import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import QrScanner from "../components/QrScanner";
import { BASE_URL } from "../utils/config";
import {
  COLLECTION_BY_LIST_URL,
  INVENTORY_LIST_URLS,
  canTakeOutside,
  gatepassApi,
  itemSource,
  itemToGatepassPayload,
  parseEquipmentQr,
} from "../utils/gatepass";

function GatePassRequest() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = user?.data?.username;
  const office = user?.data?.office || user?.data?.position || "";

  const [purpose, setPurpose] = useState("");
  const [fundCluster, setFundCluster] = useState("FREE WIFI");
  const [destination, setDestination] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [items, setItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [picker, setPicker] = useState("scan"); // scan | mine | stock
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const responses = await Promise.all(
          INVENTORY_LIST_URLS.map(async (url) => {
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();
            const collection = COLLECTION_BY_LIST_URL[url];
            return (Array.isArray(data) ? data : []).map((item) => ({
              ...item,
              _collection: collection,
            }));
          })
        );
        if (!cancelled) setCatalog(responses.flat());
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureDraft = useCallback(async () => {
    if (draftId) return draftId;
    if (!purpose.trim()) {
      throw new Error("Enter purpose before adding equipment.");
    }
    const created = await gatepassApi.create({
      requester: username,
      office,
      fund_cluster: fundCluster,
      purpose: purpose.trim(),
      destination: destination.trim(),
      requeststatus: "Draft",
      date_requested: new Date().toISOString(),
      items: [],
      history: [],
    });
    const id = created._id || created.id;
    setDraftId(id);
    return id;
  }, [draftId, purpose, fundCluster, destination, username, office]);

  const addInventoryItem = useCallback(
    async (item, collection) => {
      try {
        setBusy(true);
        setError(null);
        const source = itemSource(item, username);
        if (!source || !canTakeOutside(item, username)) {
          throw new Error("This item is not available for outside use.");
        }
        if (items.some((i) => i.inventoryId === item._id)) {
          throw new Error("Item already on this gatepass.");
        }
        const id = await ensureDraft();
        const payload = itemToGatepassPayload(
          item,
          collection,
          source,
          username
        );
        const updated = await gatepassApi.addItem(id, payload);
        setItems(updated.items || [...items, payload]);
        setMessage(`Added ${item.itemName}`);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [ensureDraft, items, username]
  );

  const handleScan = useCallback(
    async ({ collection, inventoryId }) => {
      try {
        setBusy(true);
        setError(null);
        const url = `${BASE_URL}/${collection}/inventory/${inventoryId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Equipment not found for this QR.");
        const item = await res.json();
        await addInventoryItem(item, collection);
      } catch (err) {
        setError(err.message);
        setBusy(false);
      }
    },
    [addInventoryItem]
  );

  const handleScanError = useCallback((msg) => setError(msg), []);

  useEffect(() => {
    const prefill = searchParams.get("item");
    const collection = searchParams.get("collection");
    if (!prefill || !collection || !catalog.length) return;
    const found = catalog.find(
      (c) => c._id === prefill && c._collection === collection
    );
    if (found) addInventoryItem(found, collection);
    // only once when catalog loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.length]);

  const removeItem = async (inventoryId) => {
    if (!draftId) {
      setItems((prev) => prev.filter((i) => i.inventoryId !== inventoryId));
      return;
    }
    try {
      setBusy(true);
      const updated = await gatepassApi.removeItem(draftId, inventoryId);
      setItems(updated.items || items.filter((i) => i.inventoryId !== inventoryId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError(null);
      if (!purpose.trim()) throw new Error("Purpose is required.");
      if (items.length === 0 && !draftId) {
        throw new Error("Add at least one equipment item (scan or pick).");
      }
      const id = await ensureDraft();
      if (draftId) {
        await gatepassApi.update(id, {
          purpose: purpose.trim(),
          fund_cluster: fundCluster,
          destination: destination.trim(),
        });
      }
      const currentItems = items;
      if (!currentItems.length) {
        const fresh = await gatepassApi.get(id);
        if (!fresh.items || !fresh.items.length) {
          throw new Error("Add at least one equipment item.");
        }
      }
      await gatepassApi.submit(id);
      navigate(`/gatepass/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const mine = catalog.filter(
    (i) => itemSource(i, username) === "my_inventory" && canTakeOutside(i, username)
  );
  const stock = catalog.filter(
    (i) => itemSource(i, username) === "in_stock" && canTakeOutside(i, username)
  );

  return (
    <div className="w-full sm:px-6 pt-10 pb-16">
      <div className="flex items-center mb-6 gap-3 flex-wrap">
        <p className="text-lg sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500">
          New Gatepass
        </p>
        <button
          type="button"
          onClick={() => navigate("/gatepass")}
          className="ml-auto px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          Back to list
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded border border-green-200 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div className="bg-white shadow rounded-lg p-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-700 font-medium">Purpose *</span>
            <textarea
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Purpose of taking equipment outside the office"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700 font-medium">Fund Cluster</span>
            <input
              value={fundCluster}
              onChange={(e) => setFundCluster(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700 font-medium">Destination</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Site / office / event"
            />
          </label>
          <p className="text-sm text-gray-600 md:col-span-2">
            Requester: <strong>{username}</strong>
            {office ? ` · ${office}` : ""}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            ["scan", "Scan QR"],
            ["mine", "My Inventory"],
            ["stock", "In Stock"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPicker(key)}
              className={
                "px-3 py-2 rounded-md text-sm " +
                (picker === key
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700")
              }
            >
              {label}
            </button>
          ))}
        </div>

        {picker === "scan" && (
          <QrScanner onScan={handleScan} onError={handleScanError} />
        )}

        {picker === "mine" && (
          <PickerList
            title="Your assigned equipment"
            list={mine}
            disabled={busy}
            onAdd={(item) => addInventoryItem(item, item._collection)}
          />
        )}
        {picker === "stock" && (
          <PickerList
            title="In-stock equipment"
            list={stock}
            disabled={busy}
            onAdd={(item) => addInventoryItem(item, item._collection)}
          />
        )}

        <div className="bg-white shadow rounded-lg p-5">
          <h3 className="font-semibold text-gray-800 mb-3">
            Items on this gatepass ({items.length})
          </h3>
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">
              Scan a QR or pick from My Inventory / In Stock.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((it) => (
                <li
                  key={it.inventoryId}
                  className="py-3 flex justify-between items-start gap-3"
                >
                  <div>
                    <p className="font-medium text-gray-800">{it.itemName}</p>
                    <p className="text-xs text-gray-500">
                      {it.property_no || it.serial_no || it.inventoryId} ·{" "}
                      {it.source === "in_stock" ? "In Stock" : "My Inventory"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeItem(it.inventoryId)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Working…" : "Submit for Approval"}
          </button>
          <button
            type="button"
            onClick={() => {
              const sample = window.prompt("Paste equipment QR URL to test parse");
              if (!sample) return;
              const parsed = parseEquipmentQr(sample);
              if (!parsed) setError("Invalid QR URL");
              else handleScan(parsed);
            }}
            className="px-4 py-2 border rounded-md text-sm"
          >
            Paste QR URL
          </button>
        </div>
      </form>
    </div>
  );
}

function PickerList({ title, list, onAdd, disabled }) {
  const [q, setQ] = useState("");
  const filtered = list.filter((i) =>
    (i.itemName || "").toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="bg-white shadow rounded-lg p-5">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter…"
          className="ml-auto px-3 py-1.5 border rounded-md text-sm"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No available items.</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto divide-y">
          {filtered.map((item) => (
            <li
              key={item._id}
              className="py-2 flex justify-between items-center gap-2"
            >
              <div>
                <p className="text-sm font-medium">{item.itemName}</p>
                <p className="text-xs text-gray-500">
                  {item.property_no || item.serial_no || item._id} · {item.status}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAdd(item)}
                className="px-2 py-1 text-sm bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GatePassRequest;
