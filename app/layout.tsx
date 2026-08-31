import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import AtmosphereField from "@/components/AtmosphereField";
import { motifForDate } from "@/lib/motif";
import "./globals.css";

// Three roles, three families. Weights are held to what each role actually
// uses, because the hierarchy is built from family, size, case and tracking
// rather than from weight.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Ships a single weight, so a heading cannot be bolded even by accident.
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// Every number in the app sits in this, which guarantees tabular figures.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
    // The day's motif is stamped on the document, not just on the background
    // layer, so a motif can carry a decorative treatment on non-data elements
    // as well as paint the ground. It still may never colour data.
    <html
      lang="en"
      data-motif={motifForDate()}
      className={`${jakarta.variable} ${instrument.variable} ${plexMono.variable}`}
    >
      <body className="min-h-dvh bg-bg font-sans text-fg antialiased">
        <AtmosphereField />
        {children}
      </body>
    </html>
  );
}
