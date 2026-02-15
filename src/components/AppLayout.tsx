import { Outlet } from "react-router-dom";
import DecisionSidebar from "@/components/DecisionSidebar";
import Footer from "@/components/Footer";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background flex w-full">
      <DecisionSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}