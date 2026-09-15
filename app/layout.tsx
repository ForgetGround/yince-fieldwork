import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "银策编译器 · 展业版",
  description:
    "面向小微客户经理的可解释展业工作台。制度编译、机会识别、访前准备、访后闭环。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <div className="brand-watermark" aria-hidden="true">
          {Array.from({ length: 48 }, (_, i) => (
            <span key={i}>银策YINGCE</span>
          ))}
        </div>
      </body>
    </html>
  );
}
