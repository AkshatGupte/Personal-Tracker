import type { Metadata } from "next";
import { Archivo, Bangers, Space_Mono } from "next/font/google";
import ChromaticDefs from "@/components/spiderverse/ChromaticDefs";
import SpiderverseBackground from "@/components/spiderverse/SpiderverseBackground";
import "./globals.css";

/**
 * One family. Bangers carries the entire interface.
 *
 * This reverses an earlier split that reserved the comic face for the wordmark
 * and set everything else in Archivo. The app is a comic-book interface, and
 * one mark in the comic voice over an otherwise conventional product read as a
 * hat rather than an identity — so every family token now resolves to Bangers
 * and it is inherited from `body`.
 *
 * Archivo and Space Mono are still loaded, and still earn their place: they sit
 * *behind* Bangers in the font stacks as glyph fallbacks. Bangers has a narrow
 * glyph set and no true lowercase, so anything it does not cover falls through
 * to a face that does instead of rendering tofu.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const bangers = Bangers({
  variable: "--font-bangers",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rendred",
  description: "Track what you are learning, and see whether it is well-rounded.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${bangers.variable} ${spaceMono.variable}`}
    >
      <body className="min-h-dvh font-sans text-fg antialiased">
        {/* Mounted once, here. Every route inherits the same environment and no
            screen has to remember to draw it. Replaced the five-motif
            AtmosphereField, which has been removed along with its three.js
            scene — nothing in this theme needs a renderer. */}
        <SpiderverseBackground />
        {/* Filter definitions for true chromatic aberration, defined once and
            referenced by url() from GlitchText and the page transition. */}
        <ChromaticDefs />
        {children}
      </body>
    </html>
  );
}
