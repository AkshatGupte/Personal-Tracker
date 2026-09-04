import type { Metadata } from "next";
import { Archivo, Bangers, Space_Mono } from "next/font/google";
import ChromaticDefs from "@/components/spiderverse/ChromaticDefs";
import AmbientLightning from "@/components/spiderverse/AmbientLightning";
import SpiderverseBackground from "@/components/spiderverse/SpiderverseBackground";
import { WebPageCorners } from "@/components/spiderverse/SpiderWeb";
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
        {/* Webs in the four corners of the viewport. Mounted here for the same
            reason as the atmosphere — once, so no screen has to remember it —
            and after the background so it draws over the rift glows while
            staying behind the content. */}
        <WebPageCorners />
        {/* Filter definitions for true chromatic aberration, defined once and
            referenced by url() from GlitchText and the page transition. */}
        <ChromaticDefs />
        {children}
        {/* Mounted last and above the content, unlike the atmosphere: a
            discharge comes *off* an edge, so it has to draw over the panel it
            left rather than behind it. Ambient and uncorrelated with anything
            the user does — see AmbientLightning. */}
        <AmbientLightning />
      </body>
    </html>
  );
}
