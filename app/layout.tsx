import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "ファンドアプリ",
  description: "企業評価ランキング・個別株式評価・マイポートフォリオ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="wrap">
          <header className="topbar">
            <div className="brand">ファンドアプリ</div>
            <nav className="nav">
              <Link className="navlink" href="/">
                ランキング
              </Link>
              <Link className="navlink" href="/portfolio">
                マイポートフォリオ
              </Link>
              <Link className="navlink" href="/stock/7203.T">
                個別株式評価
              </Link>
            </nav>
          </header>

          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
