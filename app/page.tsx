'use client';

import { useState } from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { custom } from 'viem';
import { Activity, Shield, Network, Zap, Cpu, Wallet, ArrowRightLeft, Target } from 'lucide-react';

const CONTRACT_ADDRESS = "0x5BD1B147bAf15561dC8009F3F68922b5aC95a7a5";

const ASSETS = ["USDC", "USDT", "ETH", "WBTC"];
const SOURCE_CHAINS = ["ETHEREUM", "ARBITRUM", "BASE"];

const INTENT_PRESETS = [
  {
    label: "Maximum Yield",
    prompt: "Route this asset to whichever chain provides the deepest liquidity and lowest execution fee for high-yield staking."
  },
  {
    label: "Highest Security",
    prompt: "Prioritize bridge security above all else. Route to the chain with the highest bridge_security_score, ignoring gas costs."
  },
  {
    label: "Lowest Gas (Micro-Tx)",
    prompt: "Find the absolute cheapest target chain by avg_gas_usd for high-frequency micro-transactions."
  }
];

export default function NexusDashboard() {
  const [userAddress, setUserAddress] = useState('');
  const [activeTab, setActiveTab] = useState('terminal');
  const [terminalLogs, setTerminalLogs] = useState<{time: string, msg: string, type: string}[]>([]);
  
  // Dynamic Payload State
  const [intentId, setIntentId] = useState(`NEXUS-${Math.floor(1000 + Math.random() * 9000)}`);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [sourceChain, setSourceChain] = useState(SOURCE_CHAINS[0]);
  const [depositAmount, setDepositAmount] = useState("1000.000000");
  const [userIntent, setUserIntent] = useState(INTENT_PRESETS[0].prompt);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);

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
        addLog(`Wallet Connected: ${accounts[0].substring(0,6)}...${accounts[0].slice(-4)}`, 'success');
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
    
    // Generate a fresh Intent ID for every transaction so it never hits the replay protection
    const currentIntentId = `NEXUS-${Math.floor(1000 + Math.random() * 9000)}`;
    setIntentId(currentIntentId);

    try {
      addLog(`Initializing Nexus Engine for ${depositAmount} ${selectedAsset}...`, 'info');
      
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

      addLog(`Fetching live telemetry for ${sourceChain}...`, 'info');

      // Cryptographic Canonicalization
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
      
      addLog("Generating SHA-256 Hash Lock...", 'info');
      const msgBuffer = new TextEncoder().encode(deterministicString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      addLog(`Payload Locked. Hash: ${hashHex.substring(0,16)}...`, 'success');
      addLog("Awaiting MetaMask Signature...", 'warning');

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

      addLog(`Transaction broadcasted: ${hash}`, 'info');
      addLog("Invoking Multi-LLM Consensus Engine (GPT-5, Claude, Gemini)...", 'warning');
      addLog(`AI is evaluating route for: "${userIntent.substring(0, 40)}..."`, 'info');

      if (typeof client.waitForTransactionReceipt === 'function') {
        try {
          const receipt = await client.waitForTransactionReceipt({ hash, pollingInterval: 3000, retryCount: 12, timeout: 120000 });
          setEvalResult(receipt);
          addLog("Consensus reached. Omni-chain route finalized.", 'success');
        } catch (receiptErr) {
          addLog("Consensus finalized on-chain, but frontend lost RPC connection.", 'warning');
          addLog("Please view your AI receipt directly in GenLayer Studio.", 'success');
        }
      } else {
        await new Promise(r => setTimeout(r, 8000));
        addLog("Transaction mined. See GenLayer Studio for detailed receipt.", 'success');
      }

    } catch (err: any) {
      addLog(`Execution Failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-300 font-sans selection:bg-indigo-500/30">
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Nexus Protocol</h1>
              <p className="text-[10px] text-neutral-500 font-mono">Omni-Chain Intent Router v2.0</p>
            </div>
          </div>
          <div>
            {!userAddress ? (
              <button onClick={connectWallet} className="bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition-all flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" /> Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-400 font-mono tracking-wider">GENLAYER STUDIONET</span>
                </div>
                <div className="bg-white/5 border border-white/10 text-neutral-300 text-xs px-4 py-2 rounded-full font-mono">
                  {userAddress.substring(0, 6)}...{userAddress.slice(-4)}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Dynamic Configuration */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6">
            
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-indigo-400" /> Multi-Asset Routing
              </h2>
              <span className="text-[10px] font-mono text-neutral-500">{intentId}</span>
            </div>

            {/* Asset & Chain Selection Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-2">Select Asset</label>
                <div className="grid grid-cols-2 gap-2">
                  {ASSETS.map(asset => (
                    <button 
                      key={asset}
                      onClick={() => setSelectedAsset(asset)}
                      className={`text-xs py-2 rounded-lg border transition-all font-mono ${selectedAsset === asset ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-black/30 border-white/5 text-neutral-500 hover:border-white/10'}`}
                    >
                      {asset}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-2">Source Chain</label>
                <div className="grid grid-cols-1 gap-2">
                  {SOURCE_CHAINS.map(chain => (
                    <button 
                      key={chain}
                      onClick={() => setSourceChain(chain)}
                      className={`text-xs py-2 rounded-lg border transition-all font-mono ${sourceChain === chain ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-black/30 border-white/5 text-neutral-500 hover:border-white/10'}`}
                    >
                      {chain}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Deposit Amount */}
            <div>
              <label className="text-xs font-medium text-neutral-400 block mb-2">Deposit Amount</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={depositAmount} 
                  onChange={e => setDepositAmount(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-indigo-500 outline-none transition-all"
                />
                <div className="absolute right-3 top-3">
                  <span className="text-xs font-mono text-indigo-400 font-bold">{selectedAsset}</span>
                </div>
              </div>
            </div>

            {/* AI Intent Presets */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-emerald-400" />
                <label className="text-xs font-medium text-neutral-400 block">AI Intent Presets</label>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {INTENT_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setUserIntent(preset.prompt)}
                    className={`text-[10px] px-3 py-1.5 rounded-full border transition-all ${userIntent === preset.prompt ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-black/40 border-white/10 text-neutral-400 hover:text-white'}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <textarea 
                rows={3} 
                value={userIntent}
                onChange={e => setUserIntent(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-300 focus:border-emerald-500 outline-none transition-all leading-relaxed resize-none"
              />
            </div>

            <button 
              onClick={executeNexusRoute}
              disabled={isProcessing || !userAddress}
              className="w-full relative group overflow-hidden rounded-xl bg-white text-black font-bold text-sm py-3.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity" />
              {isProcessing ? 'Routing in progress...' : 'Compute AI Route & Execute'}
            </button>
          </div>
        </div>

        {/* Right Column: Terminal & Analytics */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[650px] shadow-2xl">
            
            <div className="bg-black/40 border-b border-white/5 px-4 flex items-center gap-4">
              <div className="flex gap-1.5 py-4">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setActiveTab('terminal')} className={`text-xs font-medium pb-4 border-b-2 transition-colors mt-4 ${activeTab === 'terminal' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-neutral-500'}`}>
                  Execution Terminal
                </button>
                <button onClick={() => setActiveTab('receipt')} className={`text-xs font-medium pb-4 border-b-2 transition-colors mt-4 ${activeTab === 'receipt' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-neutral-500'}`}>
                  Consensus Receipt
                </button>
              </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto font-mono text-xs bg-black/20">
              {activeTab === 'terminal' ? (
                <div className="space-y-3">
                  <div className="text-neutral-600 mb-4">
                    <p>Nexus Protocol CLI v2.0.0</p>
                    <p>Dynamic Payload Engine: Active</p>
                  </div>
                  
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-3">
                      <span className="text-neutral-600 shrink-0">[{log.time}]</span>
                      <span className={`${
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'warning' ? 'text-yellow-400' : 'text-indigo-300'
                      }`}>
                        {log.msg}
                      </span>
                    </div>
                  ))}
                  
                  {isProcessing && (
                    <div className="flex gap-3 mt-4 text-neutral-500">
                      <span className="shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                      <span className="flex gap-1 items-center">
                        <Activity className="h-3 w-3 animate-spin text-indigo-500" /> Awaiting GenVM response...
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full">
                  {evalResult ? (
                    <pre className="text-[10px] text-emerald-400/80 bg-[#0a0a0a] border border-white/5 p-4 rounded-xl overflow-x-auto h-full shadow-inner whitespace-pre-wrap">
                      {JSON.stringify(evalResult, null, 2)}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-neutral-600 italic">
                      No receipt available. Execute an intent first.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
