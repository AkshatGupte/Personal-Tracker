import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-fg antialiased">
        {/*
          A faint ruled ground. The drifting gradient blobs that used to sit
          here were decoration unrelated to any data, so they were retired;
          the terrain profile now carries the light.
        */}
        <div aria-hidden="true" className="pattern-grid pointer-events-none fixed inset-0 -z-10" />
        {children}
      </body>
    </html>
  );
}
