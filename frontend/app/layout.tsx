import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../context/LanguageContext";
import { TextSizeProvider } from "../context/TextSizeContext";
import { AuthProvider } from "../context/AuthContext";

export const metadata: Metadata = {
  title: "JanSetu AI — From Citizen Voice to Government Action",
  description: "AI-Powered Citizen Grievance Intelligence & Resolution Platform for Pune Municipal Corporation (PMC)",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F5F4F0] text-[#1F2933] antialiased selection:bg-[#1F5E91] selection:text-white">
        <LanguageProvider>
          <TextSizeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </TextSizeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

