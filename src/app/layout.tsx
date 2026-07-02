import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const roundedLatin = Nunito({
  variable: "--font-rounded-latin",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grammar Trainer",
  description: "日本語の文を中国語・ヒンディー語・スペイン語で手入力回答する文法練習アプリ",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
