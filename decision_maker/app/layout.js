// app/layout.tsx
import "./globals.css";
import Link from "next/link";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="h-screen">
        <header className="h-12 border-b px-4 flex items-center justify-between">
          <div className="font-semibold">Decision Supporter</div>
          <nav className="text-sm">
            <Link href="/" className="hover:underline">Home</Link>
          </nav>
        </header>
        <main className="h-[calc(100vh-3rem)] grid grid-cols-[240px_1fr_280px]">
          {children}
        </main>
      </body>
    </html>
  );
}
