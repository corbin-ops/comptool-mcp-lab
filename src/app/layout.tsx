import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Dew Claw Comp Tool",
  description: "Password-protected Dew Claw comp-tool workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
