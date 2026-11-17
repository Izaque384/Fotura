import type { Metadata } from "next";
import DashboardConcept from "./DashboardConcept";

export const metadata: Metadata = {
  title: "Fotura — prévia da nova Visão Geral",
  description: "Conceito visual isolado para avaliação do painel interno do Fotura.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PainelConceito() {
  return <DashboardConcept />;
}
