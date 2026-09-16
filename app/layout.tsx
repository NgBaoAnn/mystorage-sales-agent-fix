import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STOW Resilient Gateway | MyStorage AI Sales Agent Prototype",
  description: "Working prototype resolving multi-turn context deadlocks and pricing streaming latency on stow.mystorage.vn",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
