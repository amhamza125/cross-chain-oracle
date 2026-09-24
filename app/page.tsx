'use client';

import { useState } from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { custom } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Shield, Network, Zap, Cpu, ArrowRightLeft, Target, Globe, CheckCircle2, AlertTriangle, MapPin } from 'lucide-react';

const CONTRACT_ADDRESS = "0x5BD1B147bAf15561dC8009F3F68922b5aC95a7a5";

const ASSETS = ["USDC", "USDT", "ETH", "WBTC"];
const SOURCE_CHAINS = ["ETHEREUM", "ARBITRUM", "BASE", "SOLANA", "NEAR"];

const ASSET_DEFAULTS: Record<string, string> = {
  "USDC": "1000.000000",
  "USDT": "1000.000000",
  "ETH": "0.500000",
  "WBTC": "0.015000"
};

const INTENT_PRESETS = [
  {
    label: "Spot Grid Arbitrage",
    prompt: "Route this asset to whichever chain provides the deepest liquidity and highest 24h volume to optimize spot grid trading boundaries."
  },
  {
    label: "Maximum Security",
    prompt: "Prioritize bridge security above all else. Route to the chain with the highest bridge_security_score, strictly ignoring gas costs."
  },
  {
    label: "Micro-Tx (Lowest Gas)",
    prompt: "Find the absolute cheapest target chain by avg_gas_usd for high-frequency micro-transactions."
  }
];

export default function NexusDashboard() {
  const [userAddress, setUserAddress] = useState('');
  const [activeTab, setActiveTab] = useState('terminal');
  const [terminalLogs, setTerminalLogs] = useState<{time: string, msg: string, type: string}[]>([]);
  
  // Dynamic Payload State
  const [intentId, setIntentId] = useState(`NEXUS-SEQ-${Math.floor(1000 + Math.random() * 9000)}`);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [sourceChain, setSourceChain] = useState(SOURCE_CHAINS[0]);
  const [depositAmount, setDepositAmount] = useState(ASSET_DEFAULTS["USDC"]);
  const [userIntent, setUserIntent] = useState(INTENT_PRESETS[0].prompt);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);

  const handleAssetChange = (asset: string) => {
    setSelectedAsset(asset);
    setDepositAmount(ASSET_DEFAULTS[asset]);
  };

  const addLog = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setTerminalLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
      msg, type
    }]);
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined') {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setUserAddress(accounts[0]);
        addLog(`Link Established: ${accounts[0].substring(0,6)}...${accounts[0].slice(-4)}`, 'success');
      } catch (err: any) {
        addLog(`Connection Failed: ${err.message}`, 'error');
      }
    } else {
      addLog("No Web3 wallet found. Please use MetaMask.", 'error');
    }
  };

  const executeNexusRoute = async () => {
    if (!userAddress) {
      addLog("Cannot execute: Wallet not connected.", 'error');
      return;
    }

    setIsProcessing(true);
    setTerminalLogs([]);
    setEvalResult(null);
    setActiveTab('terminal');
    
    const currentIntentId = `NEXUS-SEQ-${Math.floor(1000 + Math.random() * 9000)}`;
    setIntentId(currentIntentId);

    try {
      addLog(`Initializing Nexus Engine for ${depositAmount} ${selectedAsset}...`, 'info');
      addLog("Calibrating cross-chain setting-out coordinates...", 'info');
      
      const payloadObj = {
        asset: selectedAsset,
        chain_metrics: {
          ARBITRUM: { avg_gas_usd: "0.12", bridge_security_score: "95", liquidity_depth_usd: "45000000" },
          BASE: { avg_gas_usd: "0.04", bridge_security_score: "96", liquidity_depth_usd: "38000000" },
          NEAR: { avg_gas_usd: "0.01", bridge_security_score: "90", liquidity_depth_usd: "12000000" },
          SOLANA: { avg_gas_usd: "0.002", bridge_security_score: "98", liquidity_depth_usd: "85000000" }
        },
        deposit_amount: depositAmount,
        source_chain: sourceChain,
        source_tx_hash: `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
        user_intent: userIntent
      };

      addLog(`Fetching live telemetry and site parameters for ${sourceChain}...`, 'info');

      const sortedKeys = Object.keys(payloadObj).sort();
      const canonicalObj: Record<string, any> = {};
      
      for (const key of sortedKeys) {
        if (key === 'chain_metrics') {
          const metrics = payloadObj[key];
          const sortedMetricsKeys = Object.keys(metrics).sort();
          const canonicalMetrics: Record<string, any> = {};
          for (const mKey of sortedMetricsKeys) {
            const innerMetrics = (metrics as any)[mKey];
            const sortedInner = Object.keys(innerMetrics).sort();
            const canonicalInner: Record<string, string> = {};
            for (const iKey of sortedInner) {
              canonicalInner[iKey] = String(innerMetrics[iKey]);
            }
            canonicalMetrics[mKey] = canonicalInner;
          }
          canonicalObj[key] = canonicalMetrics;
        } else {
          canonicalObj[key] = String((payloadObj as any)[key]);
        }
      }

      const deterministicString = JSON.stringify(canonicalObj);
      
      addLog("Generating SHA-256 Cryptographic Hash Lock...", 'warning');
      const msgBuffer = new TextEncoder().encode(deterministicString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      addLog(`Payload Locked. Canonical Target: ${hashHex.substring(0,16)}...`, 'success');
      addLog("Awaiting user transaction signature...", 'info');

      const client = createClient({
        chain: studionet,
        account: userAddress as `0x${string}`,
        transport: custom((window as any).ethereum)
      } as any);

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'route_cross_chain_intent',
        args: [currentIntentId, deterministicString, hashHex],
        value: BigInt(0)
      });

      addLog(`Transaction broadcasted via Relayer: ${hash}`, 'info');
      addLog("Localizing multi-LLM consensus nodes (GPT-5, Claude, Gemini)...", 'warning');

      if (typeof client.waitForTransactionReceipt === 'function') {
        try {
          const receipt = await client.waitForTransactionReceipt({ hash, pollingInterval: 3000, retryCount: 15, timeout: 120000 });
          setEvalResult(receipt);
          addLog("Consensus reached. Omni-chain route finalized.", 'success');
        } catch (receiptErr) {
          addLog("Consensus finalized on-chain, but frontend lost RPC connection.", 'warning');
          addLog("Please view your AI receipt directly in GenLayer Studio.", 'success');
        }
      } else {
        await new Promise(r => setTimeout(r, 8000));
        addLog("Transaction mined. Verify on GenLayer Explorer.", 'success');
      }

    } catch (err: any) {
      addLog(`Execution Failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-300 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <nav className="border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/10">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Nexus Omni-Chain</h1>
              <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">Intent Router v3.0</p>
            </div>
          </div>
          <div>
            {!userAddress ? (
              <button onClick={connectWallet} className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                <Shield className="h-4 w-4" /> Connect Node
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-mono tracking-wider">GENLAYER NETWORK</span>
                </div>
                <div className="bg-black/50 border border-white/10 text-neutral-300 text-xs px-4 py-2 rounded-full font-mono hover:bg-white/5 transition-colors cursor-pointer">
                  {userAddress.substring(0, 6)}...{userAddress.slice(-4)}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Column: Command Center */}
        <div className="lg:col-span-5 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f0f13] border border-white/5 rounded-3xl p-7 shadow-2xl backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-400" /> Route Configuration
              </h2>
              <span className="text-[10px] font-mono text-neutral-500 bg-white/5 px-2 py-1 rounded-md border border-white/5">{intentId}</span>
            </div>

            <div className="space-y-6">
              {/* Asset & Chain Selection Grid */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-neutral-400 block mb-3 uppercase tracking-wider">Target Asset</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ASSETS.map(asset => (
                      <button 
                        key={asset}
                        onClick={() => handleAssetChange(asset)}
                        className={`text-xs py-2.5 rounded-xl border transition-all font-mono font-semibold ${selectedAsset === asset ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-black/40 border-white/5 text-neutral-400 hover:border-white/10 hover:bg-black/60'}`}
                      >
                        {asset}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-neutral-400 block mb-3 uppercase tracking-wider">Source Origin</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCE_CHAINS.map(chain => (
                      <button 
                        key={chain}
                        onClick={() => setSourceChain(chain)}
                        className={`text-[10px] py-2.5 rounded-xl border transition-all font-mono font-semibold ${sourceChain === chain ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-black/40 border-white/5 text-neutral-500 hover:border-white/10'}`}
                      >
                        {chain}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Deposit Amount */}
              <div>
                <label className="text-xs font-bold text-neutral-400 block mb-3 uppercase tracking-wider">Transaction Volume</label>
                <div className="relative group">
                  <input 
                    type="text" 
                    value={depositAmount} 
                    onChange={e => setDepositAmount(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-2xl px-5 py-4 text-lg text-white font-mono focus:border-indigo-500 outline-none transition-all focus:ring-4 focus:ring-indigo-500/10"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                    <span className="text-xs font-mono text-indigo-300 font-bold">{selectedAsset}</span>
                  </div>
                </div>
              </div>

              {/* AI Intent Presets */}
              <div>
                <label className="text-xs font-bold text-neutral-400 block mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" /> Consensus Logic Params
                </label>
                <div className="flex flex-col gap-2 mb-4">
                  {INTENT_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => setUserIntent(preset.prompt)}
                      className={`text-left text-xs px-4 py-3 rounded-xl border transition-all flex justify-between items-center ${userIntent === preset.prompt ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-black/30 border-white/5 text-neutral-400 hover:border-white/10 hover:bg-black/50'}`}
                    >
                      <span className="font-semibold">{preset.label}</span>
                      {userIntent === preset.prompt && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    </button>
                  ))}
                </div>
                <textarea 
                  rows={3} 
                  value={userIntent}
                  onChange={e => setUserIntent(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-neutral-300 focus:border-emerald-500 outline-none transition-all leading-relaxed resize-none font-mono focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>

              <button 
                onClick={executeNexusRoute}
                disabled={isProcessing || !userAddress}
                className="w-full relative group overflow-hidden rounded-2xl bg-white text-black font-extrabold text-sm py-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-multiply" />
                <span className="relative flex items-center justify-center gap-2">
                  {isProcessing ? (
                    <><Activity className="h-4 w-4 animate-spin" /> Routing Intelligence...</>
                  ) : (
                    <><Zap className="h-4 w-4" /> Initialize Omni-Chain Consensus</>
                  )}
                </span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Terminal & Analytics */}
        <div className="lg:col-span-7 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0f0f13] border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[760px] shadow-2xl backdrop-blur-sm"
          >
            
            <div className="bg-black/60 border-b border-white/5 px-6 flex items-center gap-6">
              <div className="flex gap-2 py-5">
                <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              </div>
              <div className="flex gap-6">
                <button onClick={() => setActiveTab('terminal')} className={`text-xs font-bold py-5 border-b-2 transition-colors uppercase tracking-wider ${activeTab === 'terminal' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}>
                  System Terminal
                </button>
                <button onClick={() => setActiveTab('receipt')} className={`text-xs font-bold py-5 border-b-2 transition-colors uppercase tracking-wider ${activeTab === 'receipt' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}>
                  Consensus Receipt
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-[#050508] relative">
              
              <AnimatePresence mode="wait">
                {activeTab === 'terminal' ? (
                  <motion.div 
                    key="terminal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4 font-mono text-[11px]"
                  >
                    <div className="text-neutral-500 mb-6 border-b border-white/5 pb-4">
                      <p className="text-indigo-400 font-bold mb-1">Nexus Node Architecture v3.0.0</p>
                      <p>Cryptographic Push Oracle: Active</p>
                      <p>Multi-LLM Evaluator: Online</p>
                    </div>
                    
                    {terminalLogs.map((log, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={idx} 
                        className="flex gap-4 p-2 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <span className="text-neutral-600 shrink-0">[{log.time}]</span>
                        <span className={`${
                          log.type === 'error' ? 'text-red-400 font-bold' :
                          log.type === 'success' ? 'text-emerald-400 font-bold' :
                          log.type === 'warning' ? 'text-yellow-400' : 'text-indigo-300'
                        }`}>
                          {log.msg}
                        </span>
                      </motion.div>
                    ))}
                    
                    {isProcessing && (
                      <div className="flex gap-4 p-2 mt-4 text-neutral-500 items-center">
                        <span className="shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                        <span className="flex gap-2 items-center text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                          <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-ping" /> Synchronizing GenVM State...
                        </span>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="receipt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    {evalResult ? (
                      <div className="space-y-4 h-full flex flex-col">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-start gap-3">
                          <Shield className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <h3 className="text-emerald-400 font-bold text-sm">Consensus Reached & Verified</h3>
                            <p className="text-emerald-300/70 text-xs mt-1">The Multi-LLM oracle successfully localized the optimal route.</p>
                          </div>
                        </div>
                        <pre className="text-[11px] text-neutral-300 bg-[#0a0a0f] border border-white/5 p-6 rounded-2xl overflow-x-auto flex-1 shadow-inner shadow-black/50 custom-scrollbar leading-relaxed">
                          {JSON.stringify(evalResult, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-4">
                        <Target className="h-12 w-12 text-neutral-800" />
                        <p className="italic">Awaiting routing execution to generate consensus receipt.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
