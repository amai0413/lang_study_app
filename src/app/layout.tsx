import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const roundedLatin = Nunito({
  variable: "--font-rounded-latin",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Become Native!",
  description: "ネイティブ話者に自然に通じる会話を目指す即答型言語学習アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roundedLatin.variable} h-full antialiased`}
    >
      <body className="flex min-h-full w-full flex-col">{children}</body>
    </html>
  );
}
