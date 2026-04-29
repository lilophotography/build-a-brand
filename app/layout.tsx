export const runtime = "edge";

import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const lato = Lato({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Build a Brand | LiLo Photography & Branding",
  description:
    "A brand with purpose is a brand with power. Build yours with guided AI tools and Lisa's proven 5 V's framework.",
  openGraph: {
    title: "Build a Brand | LiLo Photography & Branding",
    description: "Branding that means business.",
    siteName: "LiLo Photography & Branding",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${lato.variable} h-full`}>
        <body className="min-h-full bg-[#FAF7F2] text-[#2B2B2B] antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
