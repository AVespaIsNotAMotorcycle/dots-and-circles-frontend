import type { Metadata } from "next";
import Header from "./components/Header";
import { RomanizationProvider } from "./components/RomanizationContext";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_URL } from "./site";

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
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <RomanizationProvider>
          <Header />
          {children}
        </RomanizationProvider>
      </body>
    </html>
  );
}
