import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spelling Adventure 3D",
  description:
    "Explore a friendly forest meadow with Fern the fox and discover spelling quests.",
  applicationName: "Spelling Adventure 3D",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Spelling 3D" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7ec8f5",
};

/**
 * Runs before React: inside the Android container, fix the orientation at the
 * first possible moment (the same call the earlier games make). Harmless in a
 * browser, where window.Android does not exist.
 */
const EARLY_ORIENTATION_SCRIPT =
  'try{var a=window.Android;if(a&&typeof a.setContainerAppOrientation==="function"){a.setContainerAppOrientation("landscape")}}catch(e){}';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_ORIENTATION_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
