import SectionHeader from "./SectionHeader";

export default function Bento() {
  return (
    <section className="flex flex-col w-full bg-[#0D0D0D] py-16 px-6 md:py-[100px] md:px-[120px] gap-10 md:gap-[48px]">
      <SectionHeader
        label="[04] // CAPABILITIES"
        title={"THE FULL STACK.\nON-CHAIN GAMING."}
        titleWidth="w-full max-w-[800px]"
      />

      <div className="flex flex-col w-full gap-[2px]">
        {/* Row 1 */}
        <div className="flex flex-col md:flex-row w-full gap-[2px]">
          {/* Yellow — Trustless Escrow */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#FFD600] w-full md:flex-1">
            <span className="font-ibm-mono text-[11px] font-bold text-[#1A1A1A] tracking-[2px]">[01]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#0A0A0A] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"TRUSTLESS\nESCROW"}
            </h3>
            <p className="font-ibm-mono text-[12px] text-[#1A1A1A] tracking-[1px] leading-[1.6]">
              BOTH PLAYERS DEPOSIT SUI INTO A SHARED ON-CHAIN OBJECT. NO CUSTODIAN. NO COUNTERPARTY RISK. CODE IS LAW.
            </p>
            <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#0A0A0A] w-fit">
              <span className="font-ibm-mono text-[10px] font-bold text-[#FFD600] tracking-[2px]">[MOVE]</span>
            </div>
          </div>

          {/* Weighted Indexes */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#111111] border border-[#2D2D2D] w-full md:flex-1">
            <span className="font-ibm-mono text-[11px] font-bold text-[#FFD600] tracking-[2px]">[02]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"WEIGHTED\nINDEXES"}
            </h3>
            <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              NOT JUST SINGLE-TOKEN BETS. BUILD MULTI-ASSET PORTFOLIOS WITH CUSTOM WEIGHTS. YOUR MACRO VIEW MATTERS.
            </p>
          </div>

          {/* Immutable Records */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[320px] bg-[#0A0A0A] border border-[#2D2D2D] w-full md:flex-1">
            <span className="font-ibm-mono text-[11px] font-bold text-[#FFD600] tracking-[2px]">[03]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"IMMUTABLE\nRECORDS"}
            </h3>
            <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              EVERY INDEX COMPOSITION AND RESULT STORED AS A WALRUS BLOB. TAMPER-PROOF. FOREVER VERIFIABLE.
            </p>
            <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#FF6B35] w-fit">
              <span className="font-ibm-mono text-[10px] font-bold text-[#FF6B35] tracking-[2px]">[WALRUS]</span>
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col md:flex-row w-full gap-[2px]">
          {/* Live Settlement */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#111111] border border-[#2D2D2D] w-full md:flex-1">
            <span className="font-ibm-mono text-[11px] font-bold text-[#FFD600] tracking-[2px]">[04]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"LIVE\nSETTLEMENT"}
            </h3>
            <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              PYTH ORACLES DELIVER REAL-TIME PRICES. AUTO-SETTLEMENT VIA TATUM RPC. WINNER PAID INSTANTLY.
            </p>
          </div>

          {/* Social Sharing */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#0F0F0F] border-2 border-[#FF6B35] w-full md:flex-1">
            <span className="font-ibm-mono text-[11px] font-bold text-[#FF6B35] tracking-[2px]">[05]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"SOCIAL\nINDEX CARDS"}
            </h3>
            <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              GENERATE SHAREABLE CARDS OF YOUR INDEX. FLEX YOUR RETURNS ON X. TAG @TATUM_IO AND @WALRUSFDN.
            </p>
            <div className="flex items-center justify-center h-[28px] px-[12px] bg-[#1A1A1A] border border-[#FF6B35] w-fit">
              <span className="font-ibm-mono text-[10px] font-bold text-[#FF6B35] tracking-[2px]">[SHARE]</span>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="flex flex-col gap-5 p-8 md:p-[40px] md:h-[260px] bg-[#0A0A0A] border border-[#2D2D2D] w-full md:flex-1">
            <span className="font-ibm-mono text-[11px] font-bold text-[#FFD600] tracking-[2px]">[06]</span>
            <h3 className="font-grotesk text-[24px] md:text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] leading-[1.1] whitespace-pre-line">
              {"GLOBAL\nLEADERBOARD"}
            </h3>
            <p className="font-ibm-mono text-[12px] text-[#666666] tracking-[1px] leading-[1.6]">
              RANKED BY WIN RATE. BEST RETURNS. TOTAL EARNINGS. WEEKLY SNAPSHOTS PERSISTED ON WALRUS.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
