import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// The font variable sits on <html>: the App shell tokens live on :root and read it from there.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

const description = "A personal ledger of certifications and study paths, kept in this browser. Verified is your own label, not an issuer check.";

export const metadata: Metadata = {
  title: "Credentials | Bookchaowalit",
  description,
  metadataBase: new URL("https://certs.bookchaowalit.com"),
  alternates: { canonical: "/" },
  openGraph: { type: "website", title: "Credentials | Bookchaowalit", description, siteName: "Bookchaowalit", url: "/" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
