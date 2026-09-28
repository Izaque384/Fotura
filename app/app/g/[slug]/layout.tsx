import type { ReactNode } from "react";
import type { Metadata } from "next";
import GalleryAnalytics from "./GalleryAnalytics";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function GalleryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <GalleryAnalytics galeriaId={slug} />
      {children}
    </>
  );
}
