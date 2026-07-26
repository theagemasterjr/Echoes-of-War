import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Easy-read face for the accessibility setting. Self-hosted by next/font, so it
// is available offline and never blocks on a third-party CDN.
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Echoes of War",
  description:
    "An interactive journey through six chapters of the Second World War, told through live AI conversations with fictional composite characters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${lexend.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden bg-black font-sans">{children}</body>
    </html>
  );
}
