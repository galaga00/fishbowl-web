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

const howToPreloadImages = [
  "/assets/art/how-to/step-1.png",
  "/assets/art/how-to/step-2.png",
  "/assets/art/how-to/step-3.png",
  "/assets/art/how-to/step-4.png",
  "/assets/art/how-to/step-5.png"
];

export const metadata: Metadata = {
  title: "Fish Bowl",
  description: "A mobile-first party guessing game",
  metadataBase: new URL("https://fish-bowl-game.vercel.app"),
  openGraph: {
    title: "Fish Bowl",
    description: "A mobile-first party guessing game",
    url: "https://fish-bowl-game.vercel.app",
    siteName: "Fish Bowl",
    images: [
      {
        url: "/assets/art/social/fish%20bowl%20social%20banner.png",
        width: 1200,
        height: 630,
        alt: "Fish Bowl party guessing game"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Fish Bowl",
    description: "A mobile-first party guessing game",
    images: ["/assets/art/social/fish%20bowl%20social%20banner.png"]
  }
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
      <head>
        {howToPreloadImages.map((imagePath) => (
          <link as="image" href={imagePath} key={imagePath} rel="preload" />
        ))}
      </head>
      <body className={titanOne.variable}>
        <AnalyticsPageView />
        {children}
      </body>
    </html>
  );
}
