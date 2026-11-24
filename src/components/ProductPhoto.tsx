"use client";

import { useState } from "react";
import { CakeSlice, Coffee, Croissant, UtensilsCrossed } from "lucide-react";

type PhotoSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<PhotoSize, { box: string; icon: string }> = {
  xs: { box: "h-10 w-10 rounded-lg", icon: "h-4 w-4" },
  sm: { box: "h-12 w-12 rounded-xl", icon: "h-5 w-5" },
  md: { box: "h-20 w-20 rounded-xl", icon: "h-7 w-7" },
  lg: { box: "h-24 w-24 rounded-2xl", icon: "h-8 w-8" },
};

/**
 * Redimensiona e comprime um arquivo de imagem no navegador para Data URL (WebP/JPEG),
 * evitando payloads gigantes no banco PostgreSQL.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxSize = 640,
  quality = 0.82,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem válido (JPG, PNG ou WebP).");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 8 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
      el.src = objectUrl;
    });

    const ratio = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || maxSize) * ratio));
    const height = Math.max(1, Math.round((img.height || maxSize) * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Não foi possível processar a imagem.");
    }
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function resolveSectorMeta(sector: string, iconClass: string) {
  const s = sector.toUpperCase();
  if (s.includes("PADARIA") || s.includes("PAO")) {
    return {
      icon: <Croissant className={`${iconClass} text-[var(--accent-primary)]`} />,
      label: "Padaria",
    };
  }
  if (s.includes("CONFEITARIA") || s.includes("BOLO") || s.includes("DOCE")) {
    return {
      icon: <CakeSlice className={`${iconClass} text-[var(--accent-primary)]`} />,
      label: "Doces",
    };
  }
  if (s.includes("CAFE") || s.includes("BEBIDA")) {
    return {
      icon: <Coffee className={`${iconClass} text-[var(--accent-primary)]`} />,
      label: "Cafeteria",
    };
  }
  return {
    icon: <UtensilsCrossed className={`${iconClass} text-[var(--accent-primary)]`} />,
    label: "Bistrô",
  };
}

export function ProductPhoto({
  imageUrl,
  name,
  sector = "RESTAURANTE",
  size = "md",
  className = "",
}: {
  imageUrl?: string | null;
  name: string;
  sector?: string;
  size?: PhotoSize;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const cfg = SIZE_CLASSES[size];
  const normalizedUrl = imageUrl?.trim() || null;
  const canRenderImg = Boolean(normalizedUrl && failedUrl !== normalizedUrl);

  if (canRenderImg && normalizedUrl) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden border border-[var(--border-warm)] bg-[var(--bg-canvas)] ${cfg.box} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizedUrl}
          alt={name}
          loading="lazy"
          onError={() => setFailedUrl(normalizedUrl)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    );
  }

  const meta = resolveSectorMeta(sector, cfg.icon);

  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center border border-[var(--border-warm)] bg-[var(--bg-canvas)] text-[var(--text-primary)] ${cfg.box} ${className}`}
    >
      {meta.icon}
      {size !== "xs" && (
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {meta.label}
        </span>
      )}
    </div>
  );
}
