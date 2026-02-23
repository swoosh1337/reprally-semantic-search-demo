import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepRally — Semantic Product Search",
  description:
    "AI-powered product recommendations using vector embeddings. Find the right product for any store situation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
