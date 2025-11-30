import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "./components/toast-provider";

export const metadata: Metadata = {
  title: "MagiManager - Manage 100+ Ad Accounts Without Losing Your Mind",
  description: "The command center for agencies running massive Google Ads operations. Stop drowning in spreadsheets. Manage hundreds of accounts, team members, and client relationships from one dashboard.",
  keywords: ["Google Ads management", "agency software", "ad account management", "PPC agency tools", "Google Ads agency", "multi-account management"],
  openGraph: {
    title: "MagiManager - Scale Your Google Ads Agency",
    description: "Manage 100+ ad accounts without losing your mind. The command center for agencies that scale.",
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
