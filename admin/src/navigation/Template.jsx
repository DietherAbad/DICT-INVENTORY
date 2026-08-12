// src/layout/Template.jsx
import Sidebar from "./Sidebar";
import { useRef } from "react";

function Template(props) {
  const contentRef = useRef();

  const scrollToTop = (e) => {
    e?.preventDefault?.();
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  return (
    <div className="xl:flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="hidden xl:flex xl:flex-1 xl:min-w-0 xl:h-screen">
        <main className="flex-1 min-w-0 h-screen overflow-hidden bg-gray-50">
          <div ref={contentRef} className="h-full overflow-y-auto">
            <div className="p-6 xl:p-8">{props.children}</div>
          </div>
        </main>
      </div>

      <div className="xl:hidden">
        <div ref={contentRef}>
          <div className="mobile-content px-4 pb-4 pt-20">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

export default Template;
