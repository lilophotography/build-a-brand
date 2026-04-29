"use client";

import { useState } from "react";

export default function DownloadButton({ partial }: { partial?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brand-guide");
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Brand-Guide.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Something went wrong generating your PDF. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="px-6 py-3 bg-[#C9A96E] text-[#2B2B2B] text-sm font-medium hover:bg-[#B89555] transition-colors rounded-sm disabled:opacity-50"
    >
      {loading ? "Generating PDF..." : partial ? "Download Partial Guide" : "Download Brand Guide PDF"}
    </button>
  );
}
