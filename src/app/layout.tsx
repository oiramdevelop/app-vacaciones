import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Gestión de vacaciones", template: "%s · Vacaciones" },
  description: "Solicita y gestiona las vacaciones de tu empresa.",
  appleWebApp: { capable: true, title: "Vacaciones", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b1a33",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
