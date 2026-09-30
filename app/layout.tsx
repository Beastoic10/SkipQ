import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClarityProvider from "@/components/clarity-provider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "SkipQ — Campus Food Ordering Without The Line",
  description:
    "Order ahead from your campus cafeterias. Choose what you want, pay at pickup, and skip the queue.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased scroll-smooth" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col bg-[#FAF9F6] text-zinc-900 selection:bg-orange-500 selection:text-white">
        <ClarityProvider />
        {children}
      </body>
    </html>
  );
}
