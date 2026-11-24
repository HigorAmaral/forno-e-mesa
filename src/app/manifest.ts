import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Forno & Mesa — Gestão, Delivery & Cardápio Digital",
    short_name: "Forno & Mesa",
    description:
      "Sistema unificado para Cafeteria, Padaria, Confeitaria e Restaurante: ERP, PDV, KDS, Mesas QR, Delivery e Clube de Fidelidade.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F6F3",
    theme_color: "#181615",
    lang: "pt-BR",
    shortcuts: [
      {
        name: "Painel ERP & PDV",
        short_name: "ERP",
        url: "/",
      },
      {
        name: "Cardápio Delivery",
        short_name: "Delivery",
        url: "/delivery",
      },
      {
        name: "Clube Fidelidade & Pedidos",
        short_name: "Minha Conta",
        url: "/conta",
      },
    ],
  };
}
