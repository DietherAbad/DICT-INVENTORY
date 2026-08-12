import Sidebar from "./SidebarGovnet";
import { useRef } from "react";

function TemplateGovnet(props) {
  const contentRef = useRef();

  const scrollToTop = (e) => {
    e.preventDefault();
    contentRef.current.scrollTop = 0;
  }

  return (
    <div className="xl:flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="hidden xl:grid xl:grid-cols-[1fr] xl:h-screen">
        <main className="h-screen overflow-hidden bg-gray-50">
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

export default TemplateGovnet;
