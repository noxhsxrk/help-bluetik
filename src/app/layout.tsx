import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ติ๊กฟ้าช่วยติ๊กฟ้า - X.com Engagement Exchange",
  description: "แพลตฟอร์มประสานงานค่าน้ำใจและแลกเปลี่ยน Impressions สำหรับกลุ่มครีเอเตอร์พรีเมียม X Verify ประเทศไทย",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

