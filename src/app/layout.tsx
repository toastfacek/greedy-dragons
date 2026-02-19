import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greedy Dragons - Hoard Your Gold",
  description: "The ultimate leaderboard game. Buy gold. Climb the ranks. Become the greediest dragon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="scanlines">
        {children}
      </body>
    </html>
  );
}
