"use client";

import { CheckCircle2, Coffee, Sparkles } from "lucide-react";

type EmblemSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<
  EmblemSize,
  { box: string; icon: string; steam: string }
> = {
  sm: { box: "h-10 w-10 rounded-xl", icon: "h-5 w-5", steam: "h-4 w-7 -top-2.5" },
  md: { box: "h-12 w-12 rounded-2xl", icon: "h-6 w-6", steam: "h-5 w-8 -top-3" },
  lg: { box: "h-14 w-14 rounded-2xl", icon: "h-7 w-7", steam: "h-6 w-10 -top-3.5" },
};

export function CoffeeSteamEmblem({ size = "md" }: { size?: EmblemSize }) {
  const cfg = SIZE_MAP[size];

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      {/* Halo quente */}
      <span
        aria-hidden="true"
        className="animate-cafe-glow pointer-events-none absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(232,100,60,0.35),transparent_70%)]"
      />
      {/* Vapor subindo */}
      <svg
        aria-hidden="true"
        viewBox="0 0 36 18"
        fill="none"
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${cfg.steam}`}
      >
        <path
          d="M10 15C8.5 11.5 11.5 9 10 5C9.2 3 10.5 1.5 11 1"
          stroke="#FDE6D8"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="cafe-steam-1"
        />
        <path
          d="M18 16C16.5 12 19.5 9 18 4.5C17.2 2.5 18.6 1 19 0.5"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="cafe-steam-2"
        />
        <path
          d="M26 15C24.5 11.5 27.5 9 26 5C25.2 3 26.5 1.5 27 1"
          stroke="#F5C4AE"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="cafe-steam-3"
        />
      </svg>

      {/* Medalhão fornalha/terracota */}
      <div
        className={`relative flex items-center justify-center border border-white/20 bg-gradient-to-br from-[#E8643C] via-[#C84B28] to-[#9E3519] text-white shadow-lg shadow-[#181615]/35 ${cfg.box}`}
      >
        <Coffee className={cfg.icon} />
      </div>
    </div>
  );
}

export function CafeFloatingToast({
  message,
  offsetBottom = false,
}: {
  message: string | null;
  offsetBottom?: boolean;
}) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${
        offsetBottom ? "bottom-24 sm:bottom-8" : "bottom-6"
      }`}
    >
      <div className="animate-sheet-up flex max-w-md items-center gap-2.5 rounded-2xl border border-white/15 bg-[#181615]/95 px-4 py-3 text-sm font-medium text-[#F5F3EF] shadow-2xl backdrop-blur-md">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#E8643C]" />
        <span className="leading-snug">{message}</span>
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#F5C4AE]" />
      </div>
    </div>
  );
}
