import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tee24 Winter League - Golf Score Submission",
  description: "Submit and manage golf scores for your league",
  icons: {
    icon: "https://tee24.golf/wp-content/uploads/2023/03/Tee24-rv-2-02.png",
    shortcut: "https://tee24.golf/wp-content/uploads/2023/03/Tee24-rv-2-02.png",
    apple: "https://tee24.golf/wp-content/uploads/2023/03/Tee24-rv-2-02.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}


