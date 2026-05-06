import type { Metadata, Viewport } from "next";
import { Titan_One } from "next/font/google";
import { AnalyticsPageView } from "./analytics-page-view";
import "./globals.css";

const titanOne = Titan_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-title",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Fish Bowl",
  description: "A mobile-first party guessing game"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f8f4ec"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={titanOne.variable}>
        <AnalyticsPageView />
        {children}
      </body>
    </html>
  );
}
