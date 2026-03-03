import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Prismer Workspace",
  description: "AI-powered research workspace",
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
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
            },
          }}
        />
      </body>
    </html>
  );
}
