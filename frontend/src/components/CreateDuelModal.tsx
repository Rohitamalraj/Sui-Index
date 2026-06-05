"use client";

import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import IndexBuilder from "./IndexBuilder";
import { storeIndex, storePriceSnapshot, type IndexAsset } from "@/lib/walrus";
import { fetchAllPrices } from "@/lib/pyth";
import { buildCreateDuelTx, shortAddr, CONTRACT_CONFIG } from "@/lib/sui";
import { getExplorerUrl } from "@/lib/tatum";

type DuelStep = "build" | "configure" | "confirm" | "submitting" | "done";

interface CreateDuelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDuelCreated?: (duelObjectId: string) => void;
}

export default function CreateDuelModal({ isOpen, onClose, onDuelCreated }: CreateDuelModalProps) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [step, setStep] = useState<DuelStep>("build");
  const [assets, setAssets] = useState<IndexAsset[]>([]);
  const [entryAmount, setEntryAmount] = useState("0.5");
  const [duration, setDuration] = useState("24");
  const [blobId, setBlobId] = useState("");
  const [txDigest, setTxDigest] = useState("");
  const [duelObjectId, setDuelObjectId] = useState("");
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  if (!isOpen) return null;

  const contractDeployed = CONTRACT_CONFIG.packageId !== "0x0";

  const handleIndexSubmit = (indexAssets: IndexAsset[]) => {
    setAssets(indexAssets);
    setStep("configure");
  };

  const handleConfirm = () => setStep("confirm");

  const handleCreateDuel = async () => {
    if (!account) {
      setError("CONNECT YOUR WALLET FIRST");
      return;
    }

    setStep("submitting");
    setError("");

    try {
      // ── Step 1: Store index composition on Walrus ──
      setStatusMsg("STORING INDEX ON WALRUS...");
      const indexBlobId = await storeIndex(assets, account.address);
      setBlobId(indexBlobId);

      // ── Step 2: Store starting price snapshot on Walrus ──
      setStatusMsg("CAPTURING PRICE SNAPSHOT ON WALRUS...");
      const prices = await fetchAllPrices();
      const priceMap: Record<string, number> = {};
      for (const [symbol, data] of Object.entries(prices)) {
        priceMap[symbol] = data.price;
      }
      await storePriceSnapshot(priceMap);

      if (contractDeployed) {
        // ── Step 3: Call create_duel on-chain via Tatum RPC ──
        setStatusMsg("CREATING DUEL ON-CHAIN...");
        const tx = buildCreateDuelTx(
          Number(entryAmount),
          Number(duration) / 60, // convert minutes → hours (buildCreateDuelTx expects hours)
          indexBlobId,
          200
        );

        const result = await signAndExecute({ transaction: tx });

        setTxDigest(result.digest);

        // Extract the created Duel object ID from effects
        const createdObjects = (result as unknown as {
          effects?: { created?: { reference: { objectId: string }; owner?: unknown }[] };
        }).effects?.created;

        if (createdObjects && createdObjects.length > 0) {
          // The Duel is a shared object — find the shared one
          const sharedObj = createdObjects.find(
            (o) => typeof o.owner === "object" && o.owner !== null && "Shared" in (o.owner as object)
          );
          const objId = sharedObj?.reference?.objectId ?? createdObjects[0]?.reference?.objectId ?? "";
          setDuelObjectId(objId);
          onDuelCreated?.(objId);
        }
      }

      setStatusMsg("");
      setStep("done");
    } catch (err) {
      console.error("Failed to create duel:", err);
      setError(err instanceof Error ? err.message : "UNKNOWN ERROR");
      setStatusMsg("");
      setStep("confirm");
    }
  };

  const handleClose = () => {
    setStep("build");
    setAssets([]);
    setEntryAmount("5");
    setDuration("24");
    setBlobId("");
    setTxDigest("");
    setDuelObjectId("");
    setError("");
    setStatusMsg("");
    onClose();
  };

  const entryNum = Number(entryAmount);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex flex-col w-full max-w-[700px] max-h-[90vh] overflow-y-auto bg-[#0A0A0A] border-2 border-[#2D2D2D]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 bg-[#141414] border-b border-b-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <div className="w-[8px] h-[8px] bg-[#FFD600]" />
            <span className="font-ibm-mono text-[11px] font-bold text-[#FFD600] tracking-[2px]">
              CREATE DUEL
            </span>
            {!contractDeployed && (
              <span className="font-ibm-mono text-[9px] text-[#FF6B35] tracking-[1px] bg-[#FF6B3515] px-2 py-[2px] border border-[#FF6B3540]">
                TESTNET — WALRUS DEMO MODE
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px]">
              STEP {step === "build" ? "1/3" : step === "configure" ? "2/3" : "3/3"}
            </span>
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-[28px] h-[28px] bg-transparent border border-[#2D2D2D] hover:border-[#888] transition-colors cursor-pointer"
            >
              <span className="text-[#888] text-[14px]">×</span>
            </button>
          </div>
        </div>

        {/* ── Step 1: Build Index ── */}
        {step === "build" && (
          <IndexBuilder onSubmit={handleIndexSubmit} />
        )}

        {/* ── Step 2: Configure Duel ── */}
        {step === "configure" && (
          <div className="flex flex-col gap-[2px]">
            {/* Index summary */}
            <div className="p-6 bg-[#111111] border border-[#2D2D2D]">
              <span className="font-ibm-mono text-[10px] font-bold text-[#FFD600] tracking-[2px]">YOUR INDEX</span>
              <div className="flex flex-wrap gap-3 mt-3">
                {assets.map((a) => (
                  <div key={a.symbol} className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1A] border border-[#2D2D2D]">
                    <span className="font-grotesk text-[12px] font-bold text-[#F5F5F0]">{a.symbol}</span>
                    <span className="font-ibm-mono text-[11px] text-[#FFD600]">{a.weight}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Entry amount */}
            <div className="p-6 bg-[#0D0D0D] border border-[#2D2D2D]">
              <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px] mb-3 block">ENTRY AMOUNT (SUI)</span>

              {/* Quick-pick presets */}
              <div className="flex gap-[2px]">
                {["0.1", "0.25", "0.5", "0.75", "1"].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setEntryAmount(amt)}
                    className="flex-1 flex items-center justify-center h-[48px] transition-colors border-none cursor-pointer"
                    style={{
                      backgroundColor: entryAmount === amt ? "#FFD600" : "#1A1A1A",
                      border: entryAmount === amt ? "2px solid #FFD600" : "2px solid #2D2D2D",
                    }}
                  >
                    <span
                      className="font-grotesk text-[14px] font-bold tracking-[-1px]"
                      style={{ color: entryAmount === amt ? "#0A0A0A" : "#888" }}
                    >
                      {amt}
                    </span>
                  </button>
                ))}
              </div>

              {/* Manual input */}
              <div className="flex items-center gap-[2px] mt-[2px]">
                <div
                  className="flex items-center flex-1 h-[48px] px-4 gap-3 bg-[#111111] border-2 transition-colors"
                  style={{
                    borderColor: !["0.1","0.25","0.5","0.75","1"].includes(entryAmount) && entryAmount !== ""
                      ? "#FFD600"
                      : "#2D2D2D",
                  }}
                >
                  <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px] shrink-0">CUSTOM</span>
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
                    className="flex-1 bg-transparent font-grotesk text-[16px] font-bold text-[#F5F5F0] tracking-[-0.5px] outline-none placeholder-[#333] w-full"
                    style={{ appearance: "textfield" }}
                  />
                  <span className="font-ibm-mono text-[11px] text-[#555] shrink-0">SUI</span>
                </div>
              </div>

              {/* Validation hint */}
              {entryAmount !== "" && Number(entryAmount) <= 0 && (
                <p className="font-ibm-mono text-[10px] text-[#FF5F57] tracking-[1px] mt-2">
                  AMOUNT MUST BE GREATER THAN 0
                </p>
              )}
            </div>

            {/* Duration */}
            <div className="p-6 bg-[#111111] border border-[#2D2D2D]">
              <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px] mb-3 block">DURATION (MINUTES)</span>
              <div className="flex gap-[2px]">
                {[["2", "2M"], ["5", "5M"], ["10", "10M"], ["15", "15M"], ["30", "30M"], ["60", "60M"]].map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setDuration(val)}
                    className="flex-1 flex items-center justify-center h-[48px] transition-colors border-none cursor-pointer"
                    style={{
                      backgroundColor: duration === val ? "#FFD600" : "#1A1A1A",
                      border: duration === val ? "2px solid #FFD600" : "2px solid #2D2D2D",
                    }}
                  >
                    <span
                      className="font-grotesk text-[14px] font-bold tracking-[-1px]"
                      style={{ color: duration === val ? "#0A0A0A" : "#888" }}
                    >
                      {lbl}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary + Action */}
            <div className="p-6 bg-[#0A0A0A] border border-[#2D2D2D]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-ibm-mono text-[10px] text-[#555] tracking-[2px]">POOL TOTAL</span>
                <span className="font-grotesk text-[20px] font-bold text-[#F5F5F0] tracking-[-1px]">{entryNum * 2} SUI</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-ibm-mono text-[10px] text-[#555] tracking-[2px]">PLATFORM FEE (2%)</span>
                <span className="font-ibm-mono text-[13px] text-[#888] tracking-[1px]">{(entryNum * 2 * 0.02).toFixed(2)} SUI</span>
              </div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-ibm-mono text-[10px] text-[#555] tracking-[2px]">WINNER TAKES</span>
                <span className="font-grotesk text-[20px] font-bold text-[#4ADE80] tracking-[-1px]">{(entryNum * 2 * 0.98).toFixed(2)} SUI</span>
              </div>

              <div className="flex gap-[2px]">
                <button
                  onClick={() => setStep("build")}
                  className="flex items-center justify-center flex-1 h-[48px] bg-[#1A1A1A] border-2 border-[#2D2D2D] hover:border-[#888] transition-colors cursor-pointer"
                >
                  <span className="font-ibm-mono text-[11px] text-[#888] tracking-[2px]">← BACK</span>
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!entryAmount || Number(entryAmount) <= 0}
                  className="flex items-center justify-center flex-[2] h-[48px] transition-colors border-none cursor-pointer"
                  style={{
                    backgroundColor: !entryAmount || Number(entryAmount) <= 0 ? "#2D2D2D" : "#FFD600",
                    cursor: !entryAmount || Number(entryAmount) <= 0 ? "not-allowed" : "pointer",
                  }}
                >
                  <span
                    className="font-grotesk text-[12px] font-bold tracking-[2px]"
                    style={{ color: !entryAmount || Number(entryAmount) <= 0 ? "#555" : "#0A0A0A" }}
                  >
                    REVIEW & CONFIRM →
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm & Submit ── */}
        {step === "confirm" && (
          <div className="p-6 md:p-8 bg-[#0D0D0D]">
            <div className="flex flex-col gap-4 p-6 bg-[#111111] border-2 border-[#FFD600]">
              <span className="font-ibm-mono text-[10px] font-bold text-[#FFD600] tracking-[2px]">[CONFIRM DUEL]</span>

              <div className="flex flex-col gap-2">
                <Row label="INDEX" value={assets.map((a) => `${a.symbol} ${a.weight}%`).join(" / ")} />
                <Row label="ENTRY" value={`${entryAmount} SUI`} />
                <Row label="DURATION" value={`${duration} MINUTES`} />
                <Row label="WINNER TAKES" value={`${(entryNum * 2 * 0.98).toFixed(2)} SUI`} valueColor="#4ADE80" />
              </div>

              <div className="flex flex-col gap-1 mt-1 p-3 bg-[#0D0D0D] border border-[#1D1D1D]">
                <span className="font-ibm-mono text-[9px] text-[#555] tracking-[2px]">WHAT HAPPENS NEXT</span>
                <span className="font-ibm-mono text-[10px] text-[#666] tracking-[1px] leading-[1.7]">
                  1. YOUR INDEX IS STORED IMMUTABLY ON WALRUS{"\n"}
                  2. {entryAmount} SUI IS LOCKED IN THE ESCROW CONTRACT{"\n"}
                  3. AN OPPONENT JOINS AND THE DUEL ACTIVATES{"\n"}
                  4. AFTER {duration} MIN, PYTH ORACLE DETERMINES THE WINNER
                </span>
              </div>

              {error && (
                <div className="p-3 bg-[#1F0D0D] border border-[#FF5F57]">
                  <span className="font-ibm-mono text-[10px] text-[#FF5F57] tracking-[1px] break-all">{error}</span>
                </div>
              )}

              <div className="flex gap-[2px] mt-2">
                <button
                  onClick={() => setStep("configure")}
                  className="flex items-center justify-center flex-1 h-[48px] bg-[#1A1A1A] border-2 border-[#2D2D2D] hover:border-[#888] transition-colors cursor-pointer"
                >
                  <span className="font-ibm-mono text-[11px] text-[#888] tracking-[2px]">← BACK</span>
                </button>
                <button
                  onClick={handleCreateDuel}
                  className="flex items-center justify-center flex-[2] h-[48px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors border-none cursor-pointer"
                >
                  <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">
                    {contractDeployed ? "LOCK INDEX & CREATE DUEL →" : "STORE ON WALRUS →"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Submitting ── */}
        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center p-12 gap-6 bg-[#0D0D0D]">
            <div className="w-[48px] h-[48px] border-2 border-[#FFD600] border-t-transparent animate-spin" />
            <span className="font-ibm-mono text-[12px] text-[#FFD600] tracking-[2px]">
              {statusMsg || "PROCESSING..."}
            </span>
            <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px]">
              DO NOT CLOSE THIS WINDOW
            </span>
          </div>
        )}

        {/* ── Success ── */}
        {step === "done" && (
          <div className="flex flex-col items-center p-8 md:p-12 gap-5 bg-[#0D0D0D]">
            <div className="w-[48px] h-[48px] bg-[#4ADE80] flex items-center justify-center">
              <span className="font-grotesk text-[24px] font-bold text-[#0A0A0A]">✓</span>
            </div>
            <h3 className="font-grotesk text-[22px] font-bold text-[#F5F5F0] tracking-[-1px] text-center">
              {contractDeployed ? "DUEL CREATED ON-CHAIN" : "INDEX STORED ON WALRUS"}
            </h3>

            <div className="flex flex-col gap-2 p-4 bg-[#111111] border border-[#4ADE80] w-full">
              <Row label="WALRUS BLOB ID" value={blobId ? `${blobId.slice(0, 24)}...` : "—"} valueColor="#4ADE80" mono />
              {txDigest && (
                <Row label="TX DIGEST" value={`${txDigest.slice(0, 20)}...`} valueColor="#4ADE80" mono />
              )}
              {duelObjectId && (
                <Row label="DUEL OBJECT" value={shortAddr(duelObjectId)} valueColor="#FFD600" mono />
              )}
            </div>

            {txDigest && (
              <a
                href={getExplorerUrl("tx", txDigest)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-ibm-mono text-[10px] text-[#FFD600] tracking-[2px] underline hover:text-[#F5F5F0] transition-colors"
              >
                VIEW ON SUIVISION →
              </a>
            )}

            <p className="font-ibm-mono text-[10px] text-[#888] tracking-[1px] text-center leading-[1.6]">
              {contractDeployed
                ? "YOUR DUEL IS LIVE. SHARE THE LINK AND CHALLENGE SOMEONE TO JOIN."
                : "YOUR INDEX IS STORED ON WALRUS. DUEL CREATION GOES LIVE AFTER CONTRACT DEPLOYMENT."}
            </p>

            <button
              onClick={handleClose}
              className="flex items-center justify-center w-full h-[48px] bg-[#FFD600] hover:bg-[#e6c200] transition-colors border-none cursor-pointer"
            >
              <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">DONE</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline helper ──
function Row({
  label,
  value,
  valueColor = "#F5F5F0",
  mono = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="font-ibm-mono text-[11px] text-[#555] tracking-[1px] shrink-0">{label}</span>
      <span
        className={`${mono ? "font-ibm-mono text-[10px]" : "font-ibm-mono text-[11px]"} tracking-[1px] break-all text-right`}
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  );
}
