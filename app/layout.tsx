import type { Metadata } from "next";
import { Archivo, Bangers, Space_Mono } from "next/font/google";
import ChromaticDefs from "@/components/spiderverse/ChromaticDefs";
import AmbientGlitch from "@/components/spiderverse/AmbientGlitch";
import AmbientLightning from "@/components/spiderverse/AmbientLightning";
import DimensionalSpots from "@/components/spiderverse/DimensionalSpots";
import SpiderverseBackground from "@/components/spiderverse/SpiderverseBackground";
import { DimensionalThreads } from "@/components/spiderverse/Threads";
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
        <DimensionalThreads />
        {/* Voids in the atmosphere, mounted once and — critically — *after* the
            threads, at the same depth. A spot paints over the rift glows and
            over the neon structures while staying behind every piece of UI, so
            it eats the part of the environment it covers and never touches the
            interface. That occlusion is the whole effect: these are holes in
            the background, not shapes on top of it. See DimensionalSpots. */}
        <DimensionalSpots />
        {/* Filter definitions for true chromatic aberration, defined once and
            referenced by url() from GlitchText and the page transition. */}
        <ChromaticDefs />
        {children}
        {/* Mounted last and above the content, unlike the atmosphere: a
            discharge comes *off* an edge, so it has to draw over the panel it
            left rather than behind it. Ambient and uncorrelated with anything
            the user does — see AmbientLightning. */}
        <AmbientLightning />
        {/* The second ambient effect, on its own independent timer: every
            10-20s one element somewhere on screen corrupts for about half a
            second. Mounted beside the lightning rather than inside any screen —
            it picks its own target out of what is currently rendered, so no
            component has to offer itself up. The two stagger around each other
            on collision; see effectClock. */}
        <AmbientGlitch />
      </body>
    </html>
  );
}
