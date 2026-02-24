import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetoFun - Win Amazing Rewards!",
  description: "Promotional reward game - Play lucky number games and win exciting prizes!",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
