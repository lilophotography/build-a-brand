"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const vItems = [
  { href: "/brand-builder/vision", label: "Vision", num: "1" },
  { href: "/brand-builder/value", label: "Value", num: "2" },
  { href: "/brand-builder/voice", label: "Voice", num: "3" },
  { href: "/brand-builder/visuals", label: "Visuals", num: "4" },
  { href: "/brand-builder/visibility", label: "Visibility", num: "5" },
];

export default function AppNav() {
  const path = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-[#2B2B2B] text-white border-b border-[#3D3D3D]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="text-[#C9A96E] text-xs tracking-[0.3em] uppercase font-medium">
            LiLo
          </span>
          <span className="text-white/40">·</span>
          <span className="text-white/80 text-sm">Build a Brand</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {vItems.map((v) => {
            const active = path.startsWith(v.href);
            return (
              <Link
                key={v.href}
                href={v.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                  active
                    ? "bg-[#C9A96E]/20 text-[#C9A96E]"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] border ${
                  active ? "border-[#C9A96E] text-[#C9A96E]" : "border-white/20 text-white/30"
                }`}>
                  {v.num}
                </span>
                {v.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/brand-guide"
            className="hidden md:block text-xs text-white/50 hover:text-[#C9A96E] transition-colors"
          >
            Brand Guide
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </nav>
  );
}
