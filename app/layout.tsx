import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientErrorSuppressor from "../components/ClientErrorSuppressor";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MedLIngo - Healthcare Translation App",
  description: "Real-time healthcare translation powered by AI for better patient-provider communication.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full text-gray-900 dark:text-white bg-white dark:bg-gray-900`} suppressHydrationWarning>
        <ClientErrorSuppressor />
        {children}
      </body>
    </html>
  );
} 