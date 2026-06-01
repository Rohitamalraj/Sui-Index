"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";

const NAV_LINKS = [
  { label: "ARENA",       href: "/duels"       },
  { label: "LEADERBOARD", href: "/leaderboard" },
  { label: "PROFILE",     href: "/profile"     },
];

function WalletStatus() {
  const account = useCurrentAccount();
  if (account) {
    const short = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
    return (
      <div className="flex items-center gap-[6px] h-[32px] px-[12px] bg-[#111111] border border-[#4ADE80]">
        <div className="w-[6px] h-[6px] bg-[#4ADE80] animate-pulse" />
        <span className="font-ibm-mono text-[10px] text-[#4ADE80] tracking-[1px]">{short}</span>
      </div>
    );
  }
  return (
    <ConnectButton className="font-grotesk text-[11px] font-bold text-[#0A0A0A] bg-[#FFD600] tracking-[1.5px] px-[18px] py-[9px] hover:bg-[#F5F5F0] transition-colors border-none cursor-pointer" />
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:           scrolled ? "rgba(10,10,10,0.92)" : "rgba(10,10,10,0.60)",
        backdropFilter:       "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom:         "1px solid #1A1A1A",
      }}
    >
      <div className="flex items-center justify-between h-[60px] px-6 md:px-[48px] max-w-[1400px] mx-auto">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-[10px] shrink-0 group no-underline">
          <span className="w-[10px] h-[10px] bg-[#FFD600] group-hover:scale-110 transition-transform" />
          <span className="font-grotesk text-[13px] font-bold text-[#F5F5F0] tracking-[2.5px]">
            SUI-INDEX
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-[8px]">
          {NAV_LINKS.map(({ label, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="relative flex items-center h-[36px] px-[14px] no-underline transition-colors duration-150"
                style={{
                  color:           active ? "#FFD600" : "#666",
                  backgroundColor: active ? "#FFD60010" : "transparent",
                  borderBottom:    active ? "1.5px solid #FFD600" : "1.5px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.color = "#F5F5F0";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = active ? "#FFD600" : "#666";
                }}
              >
                <span className="font-ibm-mono text-[10px] tracking-[1.5px]">{label}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <div className="w-[1px] h-[20px] bg-[#222] mx-[4px]" />

          {/* CREATE DUEL — always highlighted */}
          <Link
            href="/create"
            className="flex items-center justify-center h-[36px] px-[18px] no-underline transition-colors duration-150"
            style={{
              backgroundColor: isActive("/create") ? "#e6c200" : "#FFD600",
              border: "none",
            }}
          >
            <span className="font-grotesk text-[11px] font-bold text-[#0A0A0A] tracking-[1.5px]">
              + CREATE DUEL
            </span>
          </Link>
        </nav>

        {/* Desktop Wallet */}
        <div className="hidden md:flex items-center gap-[14px]">
          <WalletStatus />
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden flex flex-col gap-[5px] p-2 -mr-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span className="block w-[20px] h-[1.5px] bg-[#F5F5F0] transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none" }} />
          <span className="block w-[20px] h-[1.5px] bg-[#F5F5F0] transition-opacity duration-200"
            style={{ opacity: menuOpen ? 0 : 1 }} />
          <span className="block w-[20px] h-[1.5px] bg-[#F5F5F0] transition-transform duration-200 origin-center"
            style={{ transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none" }} />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className="md:hidden overflow-hidden transition-all duration-300"
        style={{
          maxHeight:    menuOpen ? "400px" : "0px",
          background:   "rgba(10,10,10,0.97)",
          backdropFilter: "blur(14px)",
          borderBottom: menuOpen ? "1px solid #1A1A1A" : "none",
        }}
      >
        <nav className="flex flex-col px-6 py-5 gap-0">
          {NAV_LINKS.map(({ label, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 w-full font-ibm-mono text-[12px] tracking-[2px] py-[14px] border-b border-[#141414] no-underline"
                style={{ color: active ? "#FFD600" : "#666" }}
              >
                <span className="w-[4px] h-[4px] rounded-full shrink-0"
                  style={{ background: active ? "#FFD600" : "#2D2D2D" }} />
                {label}
              </Link>
            );
          })}
          <Link
            href="/create"
            className="flex items-center gap-2 w-full font-ibm-mono text-[12px] tracking-[2px] py-[14px] border-b border-[#141414] no-underline"
            style={{ color: isActive("/create") ? "#FFD600" : "#FFD60099" }}
          >
            <span className="w-[4px] h-[4px] rounded-full shrink-0 bg-[#FFD600]" />
            + CREATE DUEL
          </Link>
          <div className="pt-5">
            <WalletStatus />
          </div>
        </nav>
      </div>
    </header>
  );
}
