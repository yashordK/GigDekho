import { Outlet } from "react-router";
import TopNav from "~/components/TopNav";
import BottomNav from "~/components/BottomNav";
import Footer from "~/components/Footer";
import ProtectedRoute from "~/components/ProtectedRoute";

export default function AppLayout() {
  return (
    <ProtectedRoute>
      <div className="flex flex-col min-h-screen">
        <TopNav />
        <main id="main-content" className="flex-grow pt-[64px] pb-24 lg:pb-0">
          <Outlet />
        </main>
        <BottomNav />
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
