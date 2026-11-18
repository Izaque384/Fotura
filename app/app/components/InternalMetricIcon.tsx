import type { ReactNode } from "react";

/** Ícones decorativos das métricas internas: a cor é controlada pelo cartão. */
export type InternalMetricIconName =
  | "projects" | "folders" | "photos" | "clients"
  | "selection" | "revenue" | "sales" | "pending";

const shapes: Record<InternalMetricIconName, ReactNode> = {
  projects: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  folders: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/></>,
  photos: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m5 18 5-5 3 3 3-5 3 7"/></>,
  clients: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-3 2.5-5 6-5s6 2 6 5v2M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2 3 4v2"/></>,
  selection: <><path d="m5 12 4 4L19 6"/><rect x="2.5" y="2.5" width="19" height="19" rx="5"/></>,
  revenue: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h5"/></>,
  sales: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M9 14h6m-3-3v6"/></>,
  pending: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
};

export default function InternalMetricIcon({ name }: { name: InternalMetricIconName }) {
  return (
    <span className="ft-metric-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {shapes[name]}
      </svg>
    </span>
  );
}
