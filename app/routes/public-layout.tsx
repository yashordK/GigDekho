import { Outlet } from "react-router";
import TopNav from "~/components/TopNav";
import BottomNav from "~/components/BottomNav";
import Footer from "~/components/Footer";

export default function PublicLayout() {
  return (
    <>
      <TopNav />
      <main id="main-content" className="min-h-screen pt-[64px] pb-24 lg:pb-0">
        <Outlet />
      </main>
      <BottomNav />
      <Footer />
    </>
  );
}
