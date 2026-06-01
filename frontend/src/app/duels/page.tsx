import Navbar from "@/components/Navbar";
import DuelsList from "@/components/DuelsList";
import Footer from "@/components/Footer";
import LivePriceTicker from "@/components/LivePriceTicker";

export const metadata = {
  title: "Arena — Sui-Index",
  description: "Browse open duels, join challenges, and compete with your crypto index.",
};

export default function ArenaPage() {
  return (
    <main className="flex flex-col w-full min-h-screen bg-[#0A0A0A]">
      <Navbar />

      {/* Page header */}
      <div className="flex flex-col w-full pt-[60px] bg-[#050505] border-b border-[#1A1A1A]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 px-6 md:px-[48px] max-w-[1400px] mx-auto w-full py-10 md:py-14">
          <div className="flex flex-col gap-2">
            <span className="font-ibm-mono text-[10px] text-[#555] tracking-[3px]">// LIVE ARENA</span>
            <h1 className="font-grotesk text-[40px] md:text-[56px] font-bold text-[#F5F5F0] tracking-[-2px] leading-none">
              DUEL ARENA
            </h1>
            <p className="font-ibm-mono text-[12px] text-[#555] tracking-[1px] mt-1">
              PICK AN OPEN DUEL AND CHALLENGE WITH YOUR INDEX — OR CREATE YOUR OWN.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px]">POWERED BY</span>
              <div className="flex items-center gap-3">
                <span className="font-ibm-mono text-[10px] text-[#888] tracking-[1px] px-2 py-1 border border-[#2D2D2D]">TATUM RPC</span>
                <span className="font-ibm-mono text-[10px] text-[#888] tracking-[1px] px-2 py-1 border border-[#2D2D2D]">WALRUS</span>
                <span className="font-ibm-mono text-[10px] text-[#888] tracking-[1px] px-2 py-1 border border-[#2D2D2D]">PYTH</span>
              </div>
            </div>
          </div>
        </div>
        <LivePriceTicker />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-[48px] py-10 md:py-14">
        <DuelsList />
      </div>

      <Footer />
    </main>
  );
}
