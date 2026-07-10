export const runtime = "edge";

import type { Metadata } from "next";
import "./report-card.css";

export const metadata: Metadata = {
  title: "Website Report Card | LiLo Photography & Branding",
  description:
    "Get an honest, encouraging report card on your website. Free tool from Lisa at LiLo Photography & Branding.",
  robots: { index: false, follow: false },
};

export default function ReportCardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="lilo-report-card-root">{children}</div>;
}
