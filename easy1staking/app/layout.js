import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "EASY1 Stake Pool",
  description: `Since launching in 2020, EASY1 has minted over 2k blocks, staked over
4 million ADA and attracted a community of more than 470 delegators.`,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} `}>{children}</body>
    </html>
  );
}
