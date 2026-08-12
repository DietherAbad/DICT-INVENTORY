// src/layout/TemplateUsers.jsx
import Sidebar from "./SidebarUsers";
import { useRef } from "react";

function TemplateUsers(props) {
  const contentRef = useRef();

  const scrollToTop = (e) => {
    e?.preventDefault?.();
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  return (
    <div className="xl:flex min-h-screen bg-gray-50">
      {/* Shared Users Sidebar */}
      <Sidebar />

      {/* Desktop layout: sidebar + scrollable main content */}
      <div className="hidden xl:flex xl:flex-1 xl:min-w-0 xl:h-screen">
        <main className="flex-1 min-w-0 h-screen overflow-hidden bg-gray-50">
          <div
            ref={contentRef}
            className="h-full overflow-y-auto"
            data-scroll-container="users"
          >
            <div className="p-6 xl:p-8">{props.children}</div>
          </div>
        </main>
      </div>

      {/* Mobile / Tablet layout: top bar (inside SidebarUsers) + scrollable content */}
      <div className="xl:hidden">
        <div ref={contentRef} data-scroll-container="users">
          <div className="mobile-content px-4 pb-4 pt-20">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

export default TemplateUsers;
