import type { ReactNode } from "react";
import GalleryAnalytics from "./GalleryAnalytics";

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
