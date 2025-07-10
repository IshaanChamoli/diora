import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diora",
  description: "A clean Next.js application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
