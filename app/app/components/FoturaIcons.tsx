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
export function ArrowDownIcon(props:IconProps){return <IconBase {...props}><path d="M12 4v14"/><path d="m7 13 5 5 5-5"/></IconBase>}
export function ChevronLeftIcon(props:IconProps){return <IconBase {...props}><path d="m15 18-6-6 6-6"/></IconBase>}
export function ChevronRightIcon(props:IconProps){return <IconBase {...props}><path d="m9 6 6 6-6 6"/></IconBase>}
