import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Bloom - Video calls and meetings for everyone",
  description: "Connect, collaborate and celebrate from anywhere with Bloom",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  // Only render GoogleOAuthProvider if client ID is provided
  if (!googleClientId) {
    console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google sign-in will not work.");
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {googleClientId ? (
          <GoogleOAuthProvider clientId={googleClientId}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </GoogleOAuthProvider>
        ) : (
          <AuthProvider>
            {children}
          </AuthProvider>
        )}
      </body>
    </html>
  );
}
