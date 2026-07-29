import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Easy-read faces for the accessibility setting, both self-hosted so they are
// available offline and never block on a third-party CDN. OpenDyslexic is the
// face the toggle uses — the same one school tools like Canvas use for their
// dyslexia mode, with heavy letter bottoms so letters can't flip or swap in
// the reader's eye — and Lexend stands behind it as the fallback. The files
// ship in src/fonts (SIL Open Font License).
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"] });
const openDyslexic = localFont({
  variable: "--font-opendyslexic",
  src: [
    { path: "../fonts/OpenDyslexic-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/OpenDyslexic-Bold.woff2", weight: "700", style: "normal" },
  ],
});

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
    <html
      lang="en"
      className={`${inter.variable} ${lexend.variable} ${openDyslexic.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-black font-sans">{children}</body>
    </html>
  );
}
