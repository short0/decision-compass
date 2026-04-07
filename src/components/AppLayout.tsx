import { Outlet } from "react-router-dom";
import DecisionSidebar from "@/components/DecisionSidebar";
import Footer from "@/components/Footer";

export default function AppLayout() {
  return (
    <div className="h-screen bg-background flex w-full overflow-hidden">
      <div className="h-screen shrink-0 flex flex-col">
        <DecisionSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
