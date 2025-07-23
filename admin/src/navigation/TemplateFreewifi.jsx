import Sidebar from "./SidebarFreewifi";
import { useRef } from "react";

function TemplateFreewifi(props) {
  const contentRef = useRef();

  const scrollToTop = (e) => {
    e.preventDefault();
    contentRef.current.scrollTop = 0;
  }

  return (
    <div className="grid grid-cols-6 md:grid-cols-10 gap-0 h-full">
      <div className="col-span-1 md:col-span-1 lg:col-span-2">
        <Sidebar />
      </div>
      <div className="col-span-5 md:col-span-9 lg:col-span-8 h-full">
        <div className="relative">
          <div className="overflow-y-auto h-screen flex flex-col" ref={contentRef}>
            <div className="flex-shrink-0 p-5" style={{ marginTop: 72 }}>
              {props.children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateFreewifi;
