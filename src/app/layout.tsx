import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./studio.css";
import "./editorial.css";
import "./orbital.css";
import "./practice-reflection.css";
import "./scene-film.css";
import "./staff-studio.css";
import "./rubric-guide.css";
const figtree = localFont({
  src: "../../node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2",
  variable: "--font-studio-sans",
  weight: "300 900",
  display: "swap",
});
const garamond = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-studio-serif",
  display: "swap",
});
export const metadata: Metadata = {
  title: "IGNITE OpenStrand — Interview Studio",
  description:
    "Step into the scene. Tell your story. Build interview confidence with strand-specific questions and STAR coaching for IGNITE Professional Studies.",
  icons: { icon: "/ignite-bulb.svg", apple: "/ignite-logo.png" },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${figtree.variable} ${garamond.variable}`}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
