import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import AtmosphereField from "@/components/AtmosphereField";
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

// Applies the saved theme before first paint, so switching themes does not
// flash the wrong colours on load. Runs ahead of React by design.
const themeInit = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${instrument.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-fg antialiased">
        <AtmosphereField />
        {children}
      </body>
    </html>
  );
}
