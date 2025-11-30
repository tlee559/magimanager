import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "./components/toast-provider";

export const metadata: Metadata = {
  title: "MagiManager - AI-Powered Ad Account Management",
  description: "Scale and optimize 100s of ad accounts with AI. The command center for agencies that want to level up their advertising operations.",
  keywords: ["AI ad management", "agency automation", "ad account optimization", "AI advertising tools", "scale ad accounts"],
  openGraph: {
    title: "MagiManager - Scale & Optimize 100s of Ad Accounts",
    description: "AI-powered tools to manage, scale, and optimize your advertising operations. Level up your agency.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
          <ToastProvider />
        </Providers>
      </body>
    </html>
  );
}
