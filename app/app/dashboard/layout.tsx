import DashboardBillingGate from "./DashboardBillingGate";


export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardBillingGate>{children}</DashboardBillingGate>;
}
