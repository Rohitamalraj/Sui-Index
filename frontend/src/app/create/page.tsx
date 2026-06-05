"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import IndexBuilder from "@/components/IndexBuilder";
import { storeIndex, storePriceSnapshot, type IndexAsset } from "@/lib/walrus";
import { fetchAllPrices } from "@/lib/pyth";
import { buildCreateDuelTx, shortAddr, CONTRACT_CONFIG } from "@/lib/sui";
import { getExplorerUrl } from "@/lib/tatum";

type Step = "build" | "configure" | "confirm" | "submitting" | "done";

const AMOUNTS = ["0.1", "0.25", "0.5", "0.75", "1"];
const DURATIONS = [
  { label: "2M",  value: "2"  },
  { label: "5M",  value: "5"  },
  { label: "10M", value: "10" },
  { label: "15M", value: "15" },
  { label: "30M", value: "30" },
  { label: "60M", value: "60" },
];

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "build",     label: "BUILD INDEX"    },
    { key: "configure", label: "CONFIGURE"      },
    { key: "confirm",   label: "CONFIRM"        },
  ];
  const order: Step[] = ["build", "configure", "confirm", "submitting", "done"];
  const currentIdx = order.indexOf(current);

  return (
    <div className="flex items-center gap-0">
      {steps.map(({ key, label }, i) => {
        const stepIdx = order.indexOf(key);
        const isDone  = currentIdx > stepIdx;
        const isActive = current === key || (current === "submitting" && key === "confirm") || (current === "done" && key === "confirm");
        return (
          <div key={key} className="flex items-center">
            <div className="flex items-center gap-[8px] px-4 py-2"
              style={{ borderBottom: isActive || isDone ? "2px solid #FFD600" : "2px solid #1E1E1E" }}>
              <span
                className="font-ibm-mono text-[9px] tracking-[2px]"
                style={{ color: isDone ? "#4ADE80" : isActive ? "#FFD600" : "#444" }}
              >
                {isDone ? "✓" : `0${i + 1}`}
              </span>
              <span
                className="font-ibm-mono text-[9px] tracking-[1.5px]"
                style={{ color: isDone ? "#4ADE80" : isActive ? "#F5F5F0" : "#444" }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-[24px] h-[1px]" style={{ backgroundColor: isDone ? "#4ADE80" : "#1E1E1E" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CreateDuelPage() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [step, setStep]               = useState<Step>("build");
  const [assets, setAssets]           = useState<IndexAsset[]>([]);
  const [entryAmount, setEntryAmount] = useState("0.25");
  const [duration, setDuration]       = useState("2");
  const [blobId, setBlobId]           = useState("");
  const [txDigest, setTxDigest]       = useState("");
  const [duelObjectId, setDuelObjectId] = useState("");
  const [error, setError]             = useState("");
  const [statusMsg, setStatusMsg]     = useState("");

  const contractDeployed = CONTRACT_CONFIG.packageId !== "0x0";
  const entryNum = Number(entryAmount);

  const handleIndexSubmit = (indexAssets: IndexAsset[]) => {
    setAssets(indexAssets);
    setStep("configure");
  };

  const handleCreate = async () => {
    if (!account) { setError("CONNECT YOUR WALLET FIRST"); return; }
    setStep("submitting");
    setError("");
    console.log('[CreateDuel] Starting duel creation', { assets, entryAmount, duration, contractDeployed });

    try {
      // Step 1 — Walrus
      setStatusMsg("STORING INDEX ON WALRUS...");
      console.log('[CreateDuel] Step 1: storeIndex on Walrus...');
      const indexBlobId = await storeIndex(assets, account.address);
      setBlobId(indexBlobId);
      console.log('[CreateDuel] Walrus blobId:', indexBlobId);

      // Step 2 — Price snapshot
      setStatusMsg("CAPTURING PRICE SNAPSHOT...");
      console.log('[CreateDuel] Step 2: fetchAllPrices for snapshot...');
      const prices = await fetchAllPrices();
      const priceMap: Record<string, number> = {};
      for (const [symbol, data] of Object.entries(prices)) priceMap[symbol] = data.price;
      console.log('[CreateDuel] Price snapshot:', priceMap);
      await storePriceSnapshot(priceMap);

      // Step 3 — On-chain TX
      if (contractDeployed) {
        setStatusMsg("CREATING DUEL ON-CHAIN...");
        const durationHours = Number(duration) / 60;
        console.log('[CreateDuel] Step 3: buildCreateDuelTx', { entryAmount, durationHours, indexBlobId });
        const tx = buildCreateDuelTx(Number(entryAmount), durationHours, indexBlobId, 200);
        console.log('[CreateDuel] Sending TX to wallet...');
        const result = await signAndExecute({ transaction: tx });
        console.log('[CreateDuel] TX result:', result);
        setTxDigest(result.digest);

        const createdObjects = (result as unknown as {
          effects?: { created?: { reference: { objectId: string }; owner?: unknown }[] };
        }).effects?.created;
        console.log('[CreateDuel] Created objects:', createdObjects);

        if (createdObjects?.length) {
          const sharedObj = createdObjects.find(
            (o) => typeof o.owner === "object" && o.owner !== null && "Shared" in (o.owner as object)
          );
          const objId = sharedObj?.reference?.objectId ?? createdObjects[0]?.reference?.objectId ?? "";
          setDuelObjectId(objId);
          console.log('[CreateDuel] Duel object ID:', objId);
        }
      } else {
        console.log('[CreateDuel] Contract not deployed — skipping on-chain TX (demo mode)');
      }

      setStatusMsg("");
      setStep("done");
      console.log('[CreateDuel] Done ✓');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN ERROR";
      console.error('[CreateDuel] Error:', err);
      setError(msg);
      setStatusMsg("");
      setStep("confirm");
    }
  };

  return (
    <main className="flex flex-col w-full min-h-screen bg-[#0A0A0A]">
      <Navbar />

      {/* Page header */}
      <div className="flex flex-col w-full pt-[60px] bg-[#050505] border-b border-[#1A1A1A]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 md:px-[48px] max-w-[1400px] mx-auto w-full py-8 md:py-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Link href="/duels" className="font-ibm-mono text-[10px] text-[#555] tracking-[1px] hover:text-[#888] transition-colors no-underline">
                ← ARENA
              </Link>
              <span className="font-ibm-mono text-[10px] text-[#333]">/</span>
              <span className="font-ibm-mono text-[10px] text-[#888] tracking-[1px]">CREATE DUEL</span>
            </div>
            <h1 className="font-grotesk text-[32px] md:text-[40px] font-bold text-[#F5F5F0] tracking-[-2px] leading-none">
              CREATE A DUEL
            </h1>
          </div>
          <StepIndicator current={step} />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-[48px] py-10 md:py-14">

        {/* ── Step 1: Build Index ── */}
        {step === "build" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 mb-2">
              <span className="font-ibm-mono text-[11px] text-[#555] tracking-[2px]">STEP 01</span>
              <h2 className="font-grotesk text-[22px] font-bold text-[#F5F5F0] tracking-[-1px]">BUILD YOUR INDEX</h2>
              <p className="font-ibm-mono text-[11px] text-[#555] tracking-[1px]">
                SELECT UP TO 6 ASSETS AND ASSIGN WEIGHTS. MUST SUM TO 100%.
              </p>
            </div>
            <IndexBuilder onSubmit={handleIndexSubmit} />
          </div>
        )}

        {/* ── Step 2: Configure ── */}
        {step === "configure" && (
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left: Index summary */}
            <div className="flex flex-col gap-3 lg:w-[360px] shrink-0">
              <div className="flex flex-col gap-1 mb-2">
                <span className="font-ibm-mono text-[11px] text-[#555] tracking-[2px]">STEP 02</span>
                <h2 className="font-grotesk text-[22px] font-bold text-[#F5F5F0] tracking-[-1px]">CONFIGURE DUEL</h2>
              </div>

              {/* Index preview */}
              <div className="p-5 bg-[#111111] border border-[#1E1E1E]">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-ibm-mono text-[10px] text-[#FFD600] tracking-[2px] font-bold">YOUR INDEX</span>
                  <button
                    onClick={() => setStep("build")}
                    className="font-ibm-mono text-[9px] text-[#555] tracking-[1px] hover:text-[#888] transition-colors bg-transparent border-none cursor-pointer"
                  >
                    EDIT →
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {assets.map((a) => (
                    <div key={a.symbol} className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1A] border border-[#2D2D2D]">
                      <span className="font-grotesk text-[13px] font-bold text-[#F5F5F0]">{a.symbol}</span>
                      <span className="font-ibm-mono text-[11px] text-[#FFD600]">{a.weight}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="p-5 bg-[#111111] border border-[#1E1E1E]">
                <div className="flex flex-col gap-3">
                  <SummaryRow label="ENTRY" value={`${entryAmount} SUI`} />
                  <SummaryRow label="POOL TOTAL" value={`${entryNum * 2} SUI`} />
                  <SummaryRow label="PLATFORM FEE (2%)" value={`${(entryNum * 2 * 0.02).toFixed(2)} SUI`} />
                  <div className="h-[1px] bg-[#1E1E1E]" />
                  <SummaryRow label="WINNER TAKES" value={`${(entryNum * 2 * 0.98).toFixed(2)} SUI`} valueColor="#4ADE80" large />
                </div>
              </div>
            </div>

            {/* Right: Config controls */}
            <div className="flex flex-col flex-1 gap-4">

              {/* Entry amount */}
              <div className="flex flex-col gap-3 p-6 bg-[#111111] border border-[#1E1E1E]">
                <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px]">ENTRY AMOUNT (SUI)</span>
                <p className="font-ibm-mono text-[9px] text-[#444] tracking-[1px] -mt-1">FRACTIONAL SUI SUPPORTED</p>

                {/* Quick-pick presets */}
                <div className="flex gap-[2px]">
                  {AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setEntryAmount(amt)}
                      className="flex-1 flex items-center justify-center h-[52px] transition-all border-none cursor-pointer"
                      style={{
                        backgroundColor: entryAmount === amt ? "#FFD600" : "#0D0D0D",
                        border: entryAmount === amt ? "2px solid #FFD600" : "2px solid #1E1E1E",
                      }}
                    >
                      <span className="font-grotesk text-[16px] font-bold tracking-[-1px]"
                        style={{ color: entryAmount === amt ? "#0A0A0A" : "#555" }}>
                        {amt}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom amount input */}
                <div
                  className="flex items-center h-[52px] px-4 gap-3 bg-[#0D0D0D] border-2 transition-colors"
                  style={{
                    borderColor: !AMOUNTS.includes(entryAmount) && entryAmount !== ""
                      ? "#FFD600"
                      : "#1E1E1E",
                  }}
                >
                  <span className="font-ibm-mono text-[10px] text-[#444] tracking-[1px] shrink-0">CUSTOM</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 3.5"
                    value={entryAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || Number(v) >= 0) setEntryAmount(v);
                    }}
                    className="flex-1 bg-transparent font-grotesk text-[18px] font-bold text-[#F5F5F0] tracking-[-0.5px] outline-none placeholder-[#2A2A2A] w-full min-w-0"
                    style={{ appearance: "textfield" }}
                  />
                  <span className="font-ibm-mono text-[12px] text-[#444] shrink-0">SUI</span>
                </div>

                {/* Validation */}
                {entryAmount !== "" && Number(entryAmount) <= 0 && (
                  <p className="font-ibm-mono text-[10px] text-[#FF5F57] tracking-[1px] -mt-1">
                    AMOUNT MUST BE GREATER THAN 0
                  </p>
                )}
              </div>

              {/* Duration */}
              <div className="flex flex-col gap-3 p-6 bg-[#111111] border border-[#1E1E1E]">
                <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px]">DUEL DURATION (MINUTES)</span>
                <div className="flex gap-[2px]">
                  {DURATIONS.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => setDuration(value)}
                      className="flex-1 flex items-center justify-center h-[52px] transition-all border-none cursor-pointer"
                      style={{
                        backgroundColor: duration === value ? "#FFD600" : "#0D0D0D",
                        border: duration === value ? "2px solid #FFD600" : "2px solid #1E1E1E",
                      }}
                    >
                      <span className="font-grotesk text-[15px] font-bold tracking-[-0.5px]"
                        style={{ color: duration === value ? "#0A0A0A" : "#555" }}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* What happens next */}
              <div className="p-5 bg-[#0D0D0D] border border-[#1E1E1E]">
                <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px] mb-2 block">WHAT HAPPENS</span>
                <div className="flex flex-col gap-2">
                  {[
                    "YOUR INDEX IS STORED IMMUTABLY ON WALRUS",
                    `${entryAmount} SUI IS LOCKED IN THE ESCROW CONTRACT`,
                    "AN OPPONENT JOINS → DUEL ACTIVATES",
                    `AFTER ${duration} MIN, PYTH ORACLE DETERMINES WINNER`,
                  ].map((t, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="font-ibm-mono text-[9px] text-[#FFD600] tracking-[1px] shrink-0 mt-[1px]">0{i + 1}</span>
                      <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px] leading-[1.6]">{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => setStep("confirm")}
                disabled={!entryAmount || Number(entryAmount) <= 0}
                className="flex items-center justify-center w-full h-[52px] transition-colors border-none cursor-pointer"
                style={{
                  backgroundColor: !entryAmount || Number(entryAmount) <= 0 ? "#2D2D2D" : "#FFD600",
                  cursor: !entryAmount || Number(entryAmount) <= 0 ? "not-allowed" : "pointer",
                }}
              >
                <span
                  className="font-grotesk text-[13px] font-bold tracking-[2px]"
                  style={{ color: !entryAmount || Number(entryAmount) <= 0 ? "#555" : "#0A0A0A" }}
                >
                  REVIEW & CONFIRM →
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === "confirm" && (
          <div className="flex flex-col max-w-[640px] gap-4">
            <div className="flex flex-col gap-1 mb-2">
              <span className="font-ibm-mono text-[11px] text-[#555] tracking-[2px]">STEP 03</span>
              <h2 className="font-grotesk text-[22px] font-bold text-[#F5F5F0] tracking-[-1px]">CONFIRM & LAUNCH</h2>
            </div>

            <div className="flex flex-col gap-[2px] p-6 bg-[#111111] border-2 border-[#FFD600]">
              <span className="font-ibm-mono text-[10px] font-bold text-[#FFD600] tracking-[2px] mb-3">[DUEL SUMMARY]</span>
              <SummaryRow label="INDEX" value={assets.map((a) => `${a.symbol} ${a.weight}%`).join(" / ")} />
              <SummaryRow label="ENTRY AMOUNT" value={`${entryAmount} SUI`} />
              <SummaryRow label="DURATION" value={`${duration} MINUTES`} />
              <SummaryRow label="WINNER TAKES" value={`${(entryNum * 2 * 0.98).toFixed(2)} SUI`} valueColor="#4ADE80" large />
            </div>

            {!contractDeployed && (
              <div className="flex items-center gap-2 p-3 bg-[#1A1200] border border-[#FFD60040]">
                <span className="font-ibm-mono text-[9px] text-[#FFD600] tracking-[1px]">
                  WALRUS DEMO MODE — Index will be stored but no on-chain escrow until contract is live.
                </span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-[#1F0D0D] border border-[#FF5F57]">
                <span className="font-ibm-mono text-[10px] text-[#FF5F57] tracking-[1px] break-all">{error}</span>
              </div>
            )}

            <div className="flex gap-[2px]">
              <button
                onClick={() => setStep("configure")}
                className="flex items-center justify-center flex-1 h-[52px] bg-[#111111] border border-[#2D2D2D] hover:border-[#888] transition-colors cursor-pointer"
              >
                <span className="font-ibm-mono text-[11px] text-[#888] tracking-[2px]">← BACK</span>
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center justify-center flex-[3] h-[52px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors border-none cursor-pointer"
              >
                <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">
                  {contractDeployed ? "LOCK ESCROW & LAUNCH DUEL →" : "STORE ON WALRUS →"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Submitting ── */}
        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-8">
            <div className="relative">
              <div className="w-[64px] h-[64px] border-2 border-[#1E1E1E] rounded-full" />
              <div className="absolute inset-0 w-[64px] h-[64px] border-t-2 border-[#FFD600] rounded-full animate-spin" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="font-ibm-mono text-[13px] text-[#FFD600] tracking-[2px]">
                {statusMsg || "PROCESSING..."}
              </span>
              <span className="font-ibm-mono text-[10px] text-[#444] tracking-[1px]">DO NOT CLOSE THIS PAGE</span>
            </div>
            <div className="flex items-center gap-4">
              {["WALRUS", "CHAIN", "WALLET"].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-[6px] h-[6px] bg-[#FFD600] animate-pulse" />
                  <span className="font-ibm-mono text-[9px] text-[#555] tracking-[1px]">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="flex flex-col items-center max-w-[560px] mx-auto gap-6 py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-[56px] h-[56px] bg-[#4ADE80] flex items-center justify-center">
                <span className="font-grotesk text-[28px] font-bold text-[#0A0A0A]">✓</span>
              </div>
              <h2 className="font-grotesk text-[28px] font-bold text-[#F5F5F0] tracking-[-1px] text-center">
                {contractDeployed ? "DUEL IS LIVE!" : "INDEX STORED"}
              </h2>
              <p className="font-ibm-mono text-[11px] text-[#555] tracking-[1px] text-center leading-[1.7]">
                {contractDeployed
                  ? "YOUR DUEL IS ON-CHAIN AND WAITING FOR AN OPPONENT."
                  : "YOUR INDEX IS STORED ON WALRUS. CHALLENGE A FRIEND TO JOIN."}
              </p>
            </div>

            <div className="flex flex-col gap-[2px] p-5 bg-[#111111] border border-[#4ADE80] w-full">
              <InfoRow label="WALRUS BLOB ID" value={blobId ? `${blobId.slice(0, 28)}...` : "—"} color="#4ADE80" />
              {txDigest && <InfoRow label="TX DIGEST" value={`${txDigest.slice(0, 28)}...`} color="#4ADE80" />}
              {duelObjectId && <InfoRow label="DUEL OBJECT" value={shortAddr(duelObjectId)} color="#FFD600" />}
            </div>

            {txDigest && (
              <a href={getExplorerUrl("tx", txDigest)} target="_blank" rel="noopener noreferrer"
                className="font-ibm-mono text-[10px] text-[#FFD600] tracking-[2px] underline hover:text-[#F5F5F0] transition-colors">
                VIEW ON SUIVISION →
              </a>
            )}

            <div className="flex gap-[2px] w-full">
              <Link
                href="/duels"
                className="flex items-center justify-center flex-1 h-[52px] bg-[#111111] border border-[#2D2D2D] hover:border-[#888] transition-colors no-underline"
              >
                <span className="font-ibm-mono text-[11px] text-[#888] tracking-[2px]">VIEW ARENA</span>
              </Link>
              <button
                onClick={() => {
                  setStep("build");
                  setAssets([]);
                  setEntryAmount("0.25");
                  setDuration("2");
                  setBlobId("");
                  setTxDigest("");
                  setDuelObjectId("");
                  setError("");
                }}
                className="flex items-center justify-center flex-1 h-[52px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors border-none cursor-pointer"
              >
                <span className="font-grotesk text-[11px] font-bold text-[#0A0A0A] tracking-[2px]">+ CREATE ANOTHER</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

function SummaryRow({
  label, value, valueColor = "#F5F5F0", large = false,
}: { label: string; value: string; valueColor?: string; large?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-[6px] border-b border-[#1E1E1E] last:border-b-0">
      <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1.5px] shrink-0">{label}</span>
      <span
        className={large ? "font-grotesk text-[18px] font-bold tracking-[-0.5px]" : "font-ibm-mono text-[11px] tracking-[1px] text-right break-all"}
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-[5px] border-b border-[#1E1E1E] last:border-b-0">
      <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1.5px] shrink-0">{label}</span>
      <span className="font-ibm-mono text-[10px] tracking-[1px] break-all text-right" style={{ color }}>{value}</span>
    </div>
  );
}
