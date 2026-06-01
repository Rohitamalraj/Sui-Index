"use client";

import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import IndexBuilder from "./IndexBuilder";
import { storeIndex, storePriceSnapshot, saveDuelStartPrices, type IndexAsset } from "@/lib/walrus";
import { fetchSnapshotPrices } from "@/lib/pyth";
import { buildJoinDuelTx, shortAddr, CONTRACT_CONFIG, type OnChainDuel } from "@/lib/sui";
import { getExplorerUrl } from "@/lib/tatum";

type JoinStep = "view" | "build" | "confirm" | "submitting" | "done";

interface JoinDuelModalProps {
  isOpen: boolean;
  duel: OnChainDuel;
  onClose: () => void;
  onJoined?: () => void;
}

export default function JoinDuelModal({ isOpen, duel, onClose, onJoined }: JoinDuelModalProps) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [step, setStep] = useState<JoinStep>("view");
  const [assets, setAssets] = useState<IndexAsset[]>([]);
  const [blobId, setBlobId] = useState("");
  const [txDigest, setTxDigest] = useState("");
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  if (!isOpen) return null;

  const contractDeployed = CONTRACT_CONFIG.packageId !== "0x0";
  const entryAmountSui = duel.entryAmount;
  const durationH = Math.round(duel.durationMs / 3_600_000);

  const handleIndexSubmit = (indexAssets: IndexAsset[]) => {
    setAssets(indexAssets);
    setStep("confirm");
  };

  const handleJoin = async () => {
    if (!account) {
      setError("CONNECT YOUR WALLET FIRST");
      return;
    }

    setStep("submitting");
    setError("");

    try {
      // ── Step 1: Store opponent's index on Walrus ──
      setStatusMsg("STORING YOUR INDEX ON WALRUS...");
      const opponentBlobId = await storeIndex(assets, account.address);
      setBlobId(opponentBlobId);

      // ── Step 2: Store price snapshot on Walrus ──
      setStatusMsg("CAPTURING START PRICE SNAPSHOT ON WALRUS...");
      const priceMap = await fetchSnapshotPrices();
      const startPriceBlobId = await storePriceSnapshot(priceMap);
      saveDuelStartPrices(duel.objectId, priceMap);

      if (contractDeployed) {
        // ── Step 3: Call join_duel on-chain ──
        setStatusMsg("JOINING DUEL ON-CHAIN...");
        const tx = buildJoinDuelTx(
          duel.objectId,
          duel.entryAmount,
          opponentBlobId,
          startPriceBlobId
        );

        const result = await signAndExecute({ transaction: tx });

        setTxDigest(result.digest);
        onJoined?.();
      }

      setStatusMsg("");
      setStep("done");
    } catch (err) {
      console.error("Failed to join duel:", err);
      setError(err instanceof Error ? err.message : "UNKNOWN ERROR");
      setStatusMsg("");
      setStep("confirm");
    }
  };

  const handleClose = () => {
    setStep("view");
    setAssets([]);
    setBlobId("");
    setTxDigest("");
    setError("");
    setStatusMsg("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex flex-col w-full max-w-[700px] max-h-[90vh] overflow-y-auto bg-[#0A0A0A] border-2 border-[#2D2D2D]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 bg-[#141414] border-b border-b-[#2D2D2D]">
          <div className="flex items-center gap-3">
            <div className="w-[8px] h-[8px] bg-[#FF6B35]" />
            <span className="font-ibm-mono text-[11px] font-bold text-[#FF6B35] tracking-[2px]">
              JOIN DUEL
            </span>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-[28px] h-[28px] bg-transparent border border-[#2D2D2D] hover:border-[#888] transition-colors cursor-pointer"
          >
            <span className="text-[#888] text-[14px]">×</span>
          </button>
        </div>

        {/* ── Step: View duel info ── */}
        {step === "view" && (
          <div className="flex flex-col gap-[2px]">
            {/* Duel details */}
            <div className="p-6 bg-[#111111] border border-[#2D2D2D]">
              <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px] mb-4 block">DUEL DETAILS</span>
              <div className="flex flex-col gap-3">
                <InfoRow label="DUEL ID" value={shortAddr(duel.objectId)} />
                <InfoRow label="CREATOR" value={shortAddr(duel.creator)} />
                <InfoRow label="ENTRY" value={`${duel.entryAmount} SUI`} valueColor="#FFD600" />
                <InfoRow label="DURATION" value={`${durationH}H`} />
                <InfoRow label="POOL (AFTER 2% FEE)" value={`${(duel.entryAmount * 2 * 0.98).toFixed(2)} SUI`} valueColor="#4ADE80" />
              </div>
            </div>

            {/* Creator's index (from Walrus blob, placeholder display) */}
            <div className="p-6 bg-[#0D0D0D] border border-[#2D2D2D]">
              <span className="font-ibm-mono text-[10px] font-bold text-[#888] tracking-[2px] mb-2 block">
                CREATOR&apos;S INDEX
              </span>
              {duel.creatorBlobId ? (
                <span className="font-ibm-mono text-[10px] text-[#4ADE80] tracking-[1px]">
                  STORED ON WALRUS // {duel.creatorBlobId.slice(0, 20)}...
                </span>
              ) : (
                <span className="font-ibm-mono text-[10px] text-[#555] tracking-[1px]">INDEX DETAILS HIDDEN UNTIL DUEL ENDS</span>
              )}
              <p className="font-ibm-mono text-[9px] text-[#555] tracking-[1px] mt-2 leading-[1.6]">
                THE CREATOR&apos;S INDEX IS SEALED ON WALRUS. YOU CANNOT SEE IT BEFORE BUILDING YOURS — KEEPING THE GAME FAIR.
              </p>
            </div>

            {/* Wallet check */}
            {!account && (
              <div className="p-4 bg-[#1A1000] border border-[#FFD600]">
                <span className="font-ibm-mono text-[10px] text-[#FFD600] tracking-[1px]">
                  CONNECT YOUR WALLET TO JOIN THIS DUEL
                </span>
              </div>
            )}

            <div className="p-6 bg-[#0A0A0A] border border-[#2D2D2D]">
              <button
                onClick={() => setStep("build")}
                disabled={!account}
                className="flex items-center justify-center w-full h-[56px] transition-colors border-none cursor-pointer"
                style={{
                  backgroundColor: account ? "#FF6B35" : "#2D2D2D",
                  cursor: account ? "pointer" : "not-allowed",
                }}
              >
                <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">
                  BUILD MY INDEX & ACCEPT DUEL →
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Build Index ── */}
        {step === "build" && (
          <IndexBuilder onSubmit={handleIndexSubmit} onClose={() => setStep("view")} />
        )}

        {/* ── Step: Confirm ── */}
        {step === "confirm" && (
          <div className="p-6 md:p-8 bg-[#0D0D0D]">
            <div className="flex flex-col gap-4 p-6 bg-[#111111] border-2 border-[#FF6B35]">
              <span className="font-ibm-mono text-[10px] font-bold text-[#FF6B35] tracking-[2px]">[CONFIRM JOIN]</span>

              <div className="flex flex-col gap-2">
                <InfoRow label="YOUR INDEX" value={assets.map((a) => `${a.symbol} ${a.weight}%`).join(" / ")} />
                <InfoRow label="ENTRY REQUIRED" value={`${duel.entryAmount} SUI`} valueColor="#FFD600" />
                <InfoRow label="DURATION" value={`${durationH}H`} />
                <InfoRow label="WINNER TAKES" value={`${(duel.entryAmount * 2 * 0.98).toFixed(2)} SUI`} valueColor="#4ADE80" />
              </div>

              <p className="font-ibm-mono text-[9px] text-[#555] tracking-[1px] leading-[1.7] mt-1">
                YOUR INDEX WILL BE STORED ON WALRUS. {duel.entryAmount} SUI WILL BE LOCKED IN ESCROW.
                THE DUEL WILL ACTIVATE IMMEDIATELY AND SETTLE AFTER {durationH} HOURS USING PYTH ORACLE PRICES.
              </p>

              {error && (
                <div className="p-3 bg-[#1F0D0D] border border-[#FF5F57]">
                  <span className="font-ibm-mono text-[10px] text-[#FF5F57] tracking-[1px] break-all">{error}</span>
                </div>
              )}

              <div className="flex gap-[2px] mt-2">
                <button
                  onClick={() => setStep("build")}
                  className="flex items-center justify-center flex-1 h-[48px] bg-[#1A1A1A] border-2 border-[#2D2D2D] hover:border-[#888] transition-colors cursor-pointer"
                >
                  <span className="font-ibm-mono text-[11px] text-[#888] tracking-[2px]">← REBUILD</span>
                </button>
                <button
                  onClick={handleJoin}
                  className="flex items-center justify-center flex-[2] h-[48px] bg-[#FF6B35] hover:bg-[#e55e2a] transition-colors border-none cursor-pointer"
                >
                  <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">
                    {contractDeployed ? "LOCK INDEX & JOIN DUEL →" : "STORE ON WALRUS →"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Submitting ── */}
        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center p-12 gap-6 bg-[#0D0D0D]">
            <div className="w-[48px] h-[48px] border-2 border-[#FF6B35] border-t-transparent animate-spin" />
            <span className="font-ibm-mono text-[12px] text-[#FF6B35] tracking-[2px]">
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
            <div className="w-[48px] h-[48px] bg-[#FF6B35] flex items-center justify-center">
              <span className="font-grotesk text-[24px] font-bold text-[#0A0A0A]">⚔</span>
            </div>
            <h3 className="font-grotesk text-[22px] font-bold text-[#F5F5F0] tracking-[-1px] text-center">
              DUEL ACTIVATED!
            </h3>

            <div className="flex flex-col gap-2 p-4 bg-[#111111] border border-[#FF6B35] w-full">
              <InfoRow label="YOUR WALRUS BLOB" value={blobId ? `${blobId.slice(0, 24)}...` : "—"} valueColor="#4ADE80" />
              {txDigest && (
                <InfoRow label="TX DIGEST" value={`${txDigest.slice(0, 20)}...`} valueColor="#4ADE80" />
              )}
            </div>

            {txDigest && (
              <a
                href={getExplorerUrl("tx", txDigest)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-ibm-mono text-[10px] text-[#FFD600] tracking-[2px] underline"
              >
                VIEW ON SUIVISION →
              </a>
            )}

            <p className="font-ibm-mono text-[10px] text-[#888] tracking-[1px] text-center leading-[1.6]">
              THE DUEL IS NOW LIVE. CHECK BACK IN {durationH}H TO SEE THE RESULTS.
              MAY THE BEST INDEX WIN.
            </p>

            <button
              onClick={handleClose}
              className="flex items-center justify-center w-full h-[48px] bg-[#FF6B35] hover:bg-[#e55e2a] transition-colors border-none cursor-pointer"
            >
              <span className="font-grotesk text-[12px] font-bold text-[#0A0A0A] tracking-[2px]">LET&apos;S GO</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueColor = "#F5F5F0",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="font-ibm-mono text-[11px] text-[#555] tracking-[1px] shrink-0">{label}</span>
      <span className="font-ibm-mono text-[11px] tracking-[1px] break-all text-right" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  );
}
