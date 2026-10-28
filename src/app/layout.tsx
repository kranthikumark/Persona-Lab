import type { Metadata } from "next";
import { SkipLink } from "@/components/skip-link";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "PERSONA LAB — The Decision Studio",
    template: "%s · PERSONA LAB",
  },
  description:
    "Practice decisions. Explore consequences. Try another way in a safe, fictional conversation simulation.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("persona-lab-theme")==="light"?"light":"dark"}catch{document.documentElement.dataset.theme="dark"}`,
          }}
        />
      </head>
      <body>
        <SkipLink />
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
