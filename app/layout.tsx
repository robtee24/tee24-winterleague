import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tee24 Winter League - Golf Score Submission",
  description: "Submit and manage golf scores for your league",
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


