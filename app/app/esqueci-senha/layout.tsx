import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function EsqueciSenhaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
