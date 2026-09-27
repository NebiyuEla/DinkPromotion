import "./admin-v2.css";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminNavigation } from "@/components/AdminNavigation";
import { AdminPricingPanel } from "@/components/AdminPricingPanel";

export default function AdminPage() {
  return (
    <>
      <AdminNavigation />
      <AdminDashboard />
      <AdminPricingPanel />
    </>
  );
}
