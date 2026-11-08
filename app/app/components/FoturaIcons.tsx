"use client";

import type { SVGProps } from "react";

type IconProps=SVGProps<SVGSVGElement>&{size?:number};

function IconBase({size=18,children,...props}:IconProps){
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" focusable="false" {...props}>{children}</svg>;
}

export function ArrowLeftIcon(props:IconProps){return <IconBase {...props}><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></IconBase>}
export function ArrowRightIcon(props:IconProps){return <IconBase {...props}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></IconBase>}
export function ChevronDownIcon(props:IconProps){return <IconBase {...props}><path d="m7 9 5 5 5-5"/></IconBase>}
export function CheckIcon(props:IconProps){return <IconBase {...props}><path d="m5 12 4 4L19 6"/></IconBase>}
export function CloseIcon(props:IconProps){return <IconBase {...props}><path d="M6 6l12 12M18 6 6 18"/></IconBase>}
export function MoreIcon(props:IconProps){return <IconBase {...props}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></IconBase>}
export function DragHandleIcon(props:IconProps){return <IconBase {...props}><circle cx="9" cy="7" r=".8"/><circle cx="15" cy="7" r=".8"/><circle cx="9" cy="12" r=".8"/><circle cx="15" cy="12" r=".8"/><circle cx="9" cy="17" r=".8"/><circle cx="15" cy="17" r=".8"/></IconBase>}
export function ExternalLinkIcon(props:IconProps){return <IconBase {...props}><path d="M14 5h5v5"/><path d="M10 14 19 5"/><path d="M19 13v6H5V5h6"/></IconBase>}
export function DownloadIcon(props:IconProps){return <IconBase {...props}><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/></IconBase>}
export function GridIcon(props:IconProps){return <IconBase {...props}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></IconBase>}
export function UserIcon(props:IconProps){return <IconBase {...props}><circle cx="12" cy="8" r="3"/><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"/></IconBase>}
export function FolderIcon(props:IconProps){return <IconBase {...props}><path d="M3.5 7.5h6l2-2h9v13h-17z"/></IconBase>}
export function ImageIcon(props:IconProps){return <IconBase {...props}><rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m5.5 17 4-4 3 3 2-2 4 4"/></IconBase>}
export function CircleIcon(props:IconProps){return <IconBase {...props}><circle cx="12" cy="12" r="7"/></IconBase>}
export function PlusIcon(props:IconProps){return <IconBase {...props}><path d="M12 5v14M5 12h14"/></IconBase>}
export function ArrowDownIcon(props:IconProps){return <IconBase {...props}><path d="M12 4v14"/><path d="m7 13 5 5 5-5"/></IconBase>}
export function ChevronLeftIcon(props:IconProps){return <IconBase {...props}><path d="m15 18-6-6 6-6"/></IconBase>}
export function ChevronRightIcon(props:IconProps){return <IconBase {...props}><path d="m9 6 6 6-6 6"/></IconBase>}


export function SettingsIcon(props:IconProps){return <IconBase {...props}><path d="M10 3.7h4l.6 2.2 1.8.8 2-1.1 2.8 2.8-1.1 2 .8 1.8 2.1.6v4l-2.1.6-.8 1.8 1.1 2-2.8 2.8-2-1.1-1.8.8-.6 2.1h-4l-.6-2.1-1.8-.8-2 1.1-2.8-2.8 1.1-2-.8-1.8-2.1-.6v-4l2.1-.6.8-1.8-1.1-2 2.8-2.8 2 1.1 1.8-.8Z" transform="translate(0,-1) scale(1,.97)"/><circle cx="12" cy="12" r="3.3"/></IconBase>}
export function ActivityIcon(props:IconProps){return <IconBase {...props}><path d="M3 12h4l3-7 4 14 3-7h4"/></IconBase>}
export function EyeIcon(props:IconProps){return <IconBase {...props}><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></IconBase>}
export function LinkIcon(props:IconProps){return <IconBase {...props}><path d="M9 15l6-6"/><path d="M8.5 9.5 10 8a4 4 0 0 1 5.7 5.7l-1 1M15.5 14.5 14 16a4 4 0 0 1-5.7-5.7l1-1"/></IconBase>}
export function CopyIcon(props:IconProps){return <IconBase {...props}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></IconBase>}
export function ShareIcon(props:IconProps){return <IconBase {...props}><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></IconBase>}
export function ShoppingBagIcon(props:IconProps){return <IconBase {...props}><path d="M4 8h16l-1 12H5L4 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></IconBase>}
export function ShieldIcon(props:IconProps){return <IconBase {...props}><path d="M12 3l8 4v5c0 5-3 8-8 9-5-1-8-4-8-9V7l8-4Z"/><path d="m9 12 2 2 4-4"/></IconBase>}
export function ListIcon(props:IconProps){return <IconBase {...props}><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r=".7"/><circle cx="4.5" cy="12" r=".7"/><circle cx="4.5" cy="18" r=".7"/></IconBase>}
export function SlidersIcon(props:IconProps){return <IconBase {...props}><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="var(--ft-surface,#fff)"/><circle cx="15" cy="17" r="2.5" fill="var(--ft-surface,#fff)"/></IconBase>}
export function SparklesIcon(props:IconProps){return <IconBase {...props}><path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2ZM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z"/></IconBase>}


export function PencilIcon(props:IconProps){return <IconBase {...props}><path d="m15.5 5.5 3 3M5 19l3.8-.8L19 8a2.12 2.12 0 0 0-3-3L5.8 15.2 5 19Z"/><path d="M5 21h14"/></IconBase>}
export function TrashIcon(props:IconProps){return <IconBase {...props}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></IconBase>}
export function ArrowUpIcon(props:IconProps){return <IconBase {...props}><path d="M12 20V4"/><path d="m7 9 5-5 5 5"/></IconBase>}
