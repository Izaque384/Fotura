import DashboardBillingGate from "./DashboardBillingGate";
import StorageUsageIndicator from "./StorageUsageIndicator";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardBillingGate>{children}<StorageUsageIndicator/></DashboardBillingGate>;
}
