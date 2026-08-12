import React, { useMemo, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { hasAccessTag } from "../utils/roleAccess";
export default function StocksDashboard() {
  const { user } = useContext(AuthContext);
  const role = useMemo(() => {
    if (!user) return "";
    return (
      user.role ||
      user.user?.role ||
      user.data?.role ||
      user.data?.user?.role ||
      ""
    );
  }, [user]);
  const roleAccess = useMemo(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("roleAccess");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const canSeeOfficeDashboard = useMemo(
    () => hasAccessTag(role, "dashboard.office", roleAccess),
    [role, roleAccess]
  );

  return (
    <div className="dark:bg-gray-900">
      <section className="mx-auto container py-20 ">
        <div className="flex justify-center items-center flex-col">
          <div className="lg:text-6xl md:text-5xl text-4xl font-black leading-10 text-center text-gray-800 dark:text-white">
            <h1>DICT Inventory</h1>
          </div>
          <div className="pt-24 grid grid-cols-1 justify-center items-center xl:gap-y-16 gap-y-20 gap-x-16 lg:gap-x-20 xl:gap-x-0 lg:px-10 xl:px-0">
            {canSeeOfficeDashboard ? (
              <Link to="/officedashboard">
                <div className="cursor-pointer hover:shadow py-6 xl:px-4 rounded xl:w-96 w-60 flex justify-center items-center flex-col">
                  <div className="mb-6">
                    <svg
                      width={32}
                      height={32}
                      viewBox="0 0 32 32"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5.33325 1.33337H30.6666L26.6666 9.33337H1.33325L5.33325 1.33337Z"
                        fill="#818CF8"
                      />
                      <path
                        d="M5.33325 12H30.6666L26.6666 20H1.33325L5.33325 12Z"
                        fill="#6366F1"
                      />
                      <path
                        d="M5.33325 22.6667H30.6666L26.6666 30.6667H1.33325L5.33325 22.6667Z"
                        fill="#C7D2FE"
                      />
                    </svg>
                  </div>
                  <div className="text-gray-800 dark:text-white text-2xl font-semibold text-center">
                    <h2>Office Stocks</h2>
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 mt-2 text-lg text-center">
                    <p>Manage office stocks</p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white/70 px-6 py-5 text-center text-sm text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                You don’t have access to the office stocks dashboard.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
