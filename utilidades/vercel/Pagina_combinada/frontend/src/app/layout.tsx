'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect, useState } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedDark = localStorage.getItem('dark');
    if (savedDark) {
      setDarkMode(savedDark === 'true');
    }
  }, []);

  return (
    <html lang="es" className={darkMode ? 'dark' : ''}>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
