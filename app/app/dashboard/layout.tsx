import DashboardBillingGate from "./DashboardBillingGate";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardBillingGate>{children}</DashboardBillingGate>;
}
