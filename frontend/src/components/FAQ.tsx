"use client";

import { useState } from "react";
import SectionHeader from "./SectionHeader";

const faqs = [
  {
    q: "WHAT IS SUI-INDEX?",
    a: "SUI-INDEX IS A SOCIAL CRYPTO PREDICTION GAME ON THE SUI BLOCKCHAIN. YOU BUILD WEIGHTED INDEXES OF YOUR FAVORITE TOKENS AND COMPETE IN TIMED DUELS AGAINST OTHER PLAYERS. THE PLAYER WHOSE INDEX PERFORMS BETTER OVER THE DUEL PERIOD WINS THE ENTIRE POOL.",
  },
  {
    q: "HOW DO DUELS WORK?",
    a: "1) CREATE A DUEL BY BUILDING YOUR INDEX AND STAKING SUI. 2) AN OPPONENT JOINS WITH THEIR OWN INDEX AND MATCHING STAKE. 3) PRICES ARE TRACKED IN REAL-TIME VIA PYTH ORACLES. 4) WHEN THE TIMER EXPIRES, THE PLAYER WITH THE HIGHER WEIGHTED RETURN WINS THE POOL (MINUS A 2% FEE).",
  },
  {
    q: "WHAT TOKENS CAN I USE IN MY INDEX?",
    a: "WE SUPPORT 12 POPULAR TOKENS AT LAUNCH: BTC, ETH, SOL, SUI, AVAX, LINK, DOT, DOGE, UNI, MATIC, ADA, AND ATOM. EACH TOKEN HAS A PYTH PRICE FEED FOR ACCURATE SETTLEMENT.",
  },
  {
    q: "HOW IS TATUM USED?",
    a: "ALL BLOCKCHAIN INTERACTIONS — READING DUEL STATE, CHECKING BALANCES, SUBMITTING TRANSACTIONS — FLOW THROUGH TATUM'S ENTERPRISE-GRADE SUI RPC GATEWAY. THIS GIVES US RELIABLE, FAST, AND INDEXED ACCESS TO THE SUI NETWORK.",
  },
  {
    q: "HOW IS WALRUS USED?",
    a: "INDEX COMPOSITIONS, PRICE SNAPSHOTS AT DUEL START, AND FINAL RESULTS ARE ALL STORED AS IMMUTABLE BLOBS ON WALRUS DECENTRALIZED STORAGE. THIS CREATES A PERMANENT, TAMPER-PROOF RECORD OF EVERY DUEL THAT ANYONE CAN VERIFY.",
  },
  {
    q: "IS IT SAFE? CAN I GET SCAMMED?",
    a: "FUNDS ARE HELD IN A SHARED MOVE OBJECT ON-CHAIN — NEITHER PLAYER NOR THE PLATFORM CAN ACCESS THEM UNTIL SETTLEMENT. SETTLEMENT IS AUTOMATED USING PYTH ORACLE PRICES. THE SMART CONTRACT IS THE ONLY AUTHORITY.",
  },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="flex flex-col w-full bg-[#0A0A0A] py-16 px-6 md:py-[100px] md:px-[120px] gap-12 md:gap-[64px]">
      <SectionHeader
        label="[06] // FAQ"
        title={"QUESTIONS?\nANSWERS."}
      />

      <div className="flex flex-col w-full">
        {faqs.map((faq, i) => {
          const isOpen = openIdx === i;
          return (
            <button
              key={i}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="flex flex-col w-full border-b border-b-[#2D2D2D] text-left bg-transparent cursor-pointer border-x-0 border-t-0"
            >
              <div className="flex items-center justify-between w-full py-[24px] md:py-[28px]">
                <div className="flex items-center gap-[16px]">
                  <span className="font-ibm-mono text-[11px] font-bold text-[#FFD600] tracking-[2px] shrink-0">
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <span className="font-grotesk text-[14px] md:text-[18px] font-bold text-[#F5F5F0] tracking-[0.5px]">
                    {faq.q}
                  </span>
                </div>
                <span
                  className="font-grotesk text-[20px] text-[#FFD600] shrink-0 transition-transform duration-200"
                  style={{ transform: isOpen ? "rotate(45deg)" : "none" }}
                >
                  +
                </span>
              </div>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: isOpen ? "300px" : "0px" }}
              >
                <p className="font-ibm-mono text-[11px] md:text-[12px] text-[#888888] tracking-[1px] leading-[1.8] pb-[24px] pl-[40px] md:pl-[48px] max-w-[800px]">
                  {faq.a}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
