import type { SVGProps } from "react";

export type UiIconName =
  | "arrow-left" | "arrow-right" | "chevron-down" | "chevron-left" | "chevron-right"
  | "check" | "close" | "more-horizontal" | "more-vertical" | "grip"
  | "external" | "download" | "plus" | "image";

export default function UiIcon({
  name,size=16,strokeWidth=1.9,className,...props
}:{name:UiIconName;size?:number;strokeWidth?:number;className?:string}&Omit<SVGProps<SVGSVGElement>,"name">){
  const common={fill:"none",stroke:"currentColor",strokeWidth,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  const path=(()=>{
    switch(name){
      case "arrow-left": return <><path d="M19 12H5" {...common}/><path d="m11 18-6-6 6-6" {...common}/></>;
      case "arrow-right": return <><path d="M5 12h14" {...common}/><path d="m13 6 6 6-6 6" {...common}/></>;
      case "chevron-down": return <path d="m7 10 5 5 5-5" {...common}/>;
      case "chevron-left": return <path d="m14.5 6-6 6 6 6" {...common}/>;
      case "chevron-right": return <path d="m9.5 6 6 6-6 6" {...common}/>;
      case "check": return <path d="m5 12 4.2 4.2L19 6.8" {...common}/>;
      case "close": return <><path d="M6 6l12 12" {...common}/><path d="M18 6 6 18" {...common}/></>;
      case "more-horizontal": return <><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></>;
      case "more-vertical": return <><circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/></>;
      case "grip": return <><circle cx="9" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="17" r="1.2" fill="currentColor"/><circle cx="15" cy="17" r="1.2" fill="currentColor"/></>;
      case "external": return <><path d="M14 5h5v5" {...common}/><path d="m19 5-8 8" {...common}/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" {...common}/></>;
      case "download": return <><path d="M12 4v11" {...common}/><path d="m7.5 11 4.5 4.5 4.5-4.5" {...common}/><path d="M5 20h14" {...common}/></>;
      case "plus": return <><path d="M12 5v14" {...common}/><path d="M5 12h14" {...common}/></>;
      case "image": return <><rect x="4" y="5" width="16" height="14" rx="2" {...common}/><circle cx="9" cy="10" r="1.5" {...common}/><path d="m6 17 4.2-4 2.8 2.6 2.5-2.4L20 17" {...common}/></>;
    }
  })();
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className} {...props}>{path}</svg>;
}
