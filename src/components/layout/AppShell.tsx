import { Outlet } from "react-router-dom";
import { NavSidebar } from "./NavSidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  return (
    <div className="flex h-full bg-bg-base overflow-hidden">
      <NavSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
