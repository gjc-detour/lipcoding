import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchInboxItems } from "../lib/api";

const NAV_ITEMS = [
  { to: "/", label: "Inbox", icon: "📥" },
  { to: "/schedule", label: "Schedule", icon: "📅" },
  { to: "/search", label: "Search", icon: "🔍" },
] as const;

function navClassName(isActive: boolean) {
  return `flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
    isActive
      ? "bg-indigo-600 text-white shadow-sm"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
  }`;
}

function bottomNavClassName(isActive: boolean) {
  return `flex min-w-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition ${
    isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"
  }`;
}

export default function Sidebar() {
  const location = useLocation();
  const { displayName, logout } = useAuth();
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadCount = async () => {
      try {
        const response = await fetchInboxItems();
        if (isMounted) {
          setInboxCount(response.total);
        }
      } catch {
        if (isMounted) {
          setInboxCount(0);
        }
      }
    };

    void loadCount();
    const intervalId = window.setInterval(() => {
      void loadCount();
    }, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [location.pathname]);

  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-gray-200 bg-white px-5 py-6 xl:flex xl:flex-col">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-2xl">
            🧠
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">LipCoding</p>
            <p className="text-sm text-gray-500">Personal productivity assistant</p>
          </div>
        </div>

        <nav role="navigation" aria-label="Main navigation" className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => navClassName(isActive)}
            >
              <span className="flex items-center gap-3">
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </span>
              {item.label === "Inbox" ? (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                  {inboxCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">{displayName ?? "Signed in"}</p>
          <button
            type="button"
            onClick={() => {
              void logout();
            }}
            className="mt-3 text-sm font-medium text-indigo-600 transition hover:text-indigo-500"
          >
            Log out
          </button>
        </div>
      </aside>

      <nav
        role="navigation"
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-gray-200 bg-white px-2 py-2 xl:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => bottomNavClassName(isActive)}
          >
            <span aria-hidden="true" className="text-lg">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
