import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "IGNITE Interview Coach",
  description:
    "Practice. Reflect. Improve. Strand-specific interview preparation for IGNITE Professional Studies.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
