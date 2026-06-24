import "./globals.css";

export const metadata = {
  title: "Compra de Subway — Monitoreo de medios",
  description:
    "Seguimiento de la cobertura sobre la compra/adquisición de la franquicia Subway en Costa Rica en los 12 medios principales.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
