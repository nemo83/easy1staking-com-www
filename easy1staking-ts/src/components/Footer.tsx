import React from "react";
import Link from "next/link";

const Footer = () => {
  const tools = [
    { name: "WMTx Conversion", href: "/wmtx-conversion" },
    { name: "Kreate Delist", href: "/kreate-delist" },
    { name: "UPLC.link", href: "/tools/uplc-link" },
  ];

  return (
    <footer className="bg-black/20 backdrop-blur-sm mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Social Links */}
          <div>
            <h3 className="text-white font-semibold mb-3">Connect</h3>
            <div className="flex gap-4">
              <a
                href="https://github.com/easy1staking-com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://x.com/cryptojoe101"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
              >
                X
              </a>
            </div>
          </div>

          {/* Tools */}
          <div>
            <h3 className="text-white font-semibold mb-3">Tools</h3>
            <ul className="space-y-2">
              {tools.map((tool) => (
                <li key={tool.href}>
                  <Link
                    href={tool.href}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empty column for balance or future use */}
          <div></div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 mt-8 pt-6">
          <p className="text-gray-400 text-center text-sm">
            © 2026 easy1staking.com. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
