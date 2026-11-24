import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Forno & Mesa ERP — Padaria, Confeitaria & Restaurante",
  description:
    "Sistema completo de gestão gastronômica: PDV Balcão, Mesas e Comandas, Cardápio Digital QR Code, Delivery, KDS Cozinha/Forno, Encomendas, Fidelidade e Financeiro/DRE.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6F3" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0E0D" },
  ],
};

const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("forno_theme");
  if (t === "dark" || (!t && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  } else {
    document.documentElement.dataset.theme = "light";
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
