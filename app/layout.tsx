import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "./components/Header";
import "./globals.css";
import { SITE_URL } from "./site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Makes the Open Graph image's URL absolute
  metadataBase: new URL(SITE_URL),
  title: {
    // The home page's, which says what it is
    default: "Dots and Circles: Manchu OCR",
    template: "%s · Dots and Circles",
  },
  // The one address to index the home page under, not the Heroku one (each
  // other page gives its own)
  alternates: { canonical: "/" },
  // For links shared on social sites and chat apps, which show
  // opengraph-image.png large
  openGraph: {
    type: "website",
    siteName: "Dots and Circles",
    locale: "en",
  },
  twitter: { card: "summary_large_image" },
  description: "Read printed Manchu with OCR. Upload a page or a PDF and get its text in Manchu script and Abkai romanization, check words flagged against Manchu dictionaries, and save it as text.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
      </body>
    </html>
  );
}
