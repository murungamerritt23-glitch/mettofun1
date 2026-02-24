import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetoFun - Win Amazing Rewards!",
  description: "Promotional reward game - Play lucky number games and win exciting prizes!",
  viewport: "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5",
  themeColor: "#1a1a1a",
  appleMobileWebAppCapable: "yes",
  appleMobileWebAppStatusBarStyle: "black-translucent",
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
