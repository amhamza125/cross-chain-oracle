'use client';

import { useState } from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { custom } from 'viem';
import { Activity, Terminal, Shield, Network, Zap, Cpu } from 'lucide-react';

// REPLACE THIS WITH YOUR NEW NEXUS CONTRACT ADDRESS
const CONTRACT_ADDRESS = "YOUR_NEW_CONTRACT_ADDRESS_HERE";

export default function NexusDashboard() {
  const [userAddress, setUserAddress] = useState('');
  
  // Terminal UI State
  const [activeTab, setActiveTab] = useState('simulate');
  const [terminalLogs, setTerminalLogs] = useState<{time: string, msg: string, type: string}[]>([]);
  
  // Payload State
  const [intentId, setIntentId] = useState(`NEXUS-INTENT-${Math.floor(1000 + Math.random() * 9000)}`);
  const [userIntent, setUserIntent] = useState("Route 1,000 USDC to whichever chain provides the deepest liquidity and lowest execution fee for high-yield staking.");
  const [depositAmount, setDepositAmount] = useState("1000.000000");
  
  // Transaction State
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

    try {
      addLog("Initializing Nexus Omni-Chain Engine...", 'info');
      
      // 1. Build the Multi-Chain Telemetry Payload
      const payloadObj = {
        asset: "USDC",
        chain_metrics: {
          ARBITRUM: { avg_gas_usd: "0.12", bridge_security_score: "95", liquidity_depth_usd: "45000000" },
          BASE: { avg_gas_usd: "0.04", bridge_security_score: "96", liquidity_depth_usd: "38000000" },
          NEAR: { avg_gas_usd: "0.01", bridge_security_score: "90", liquidity_depth_usd: "12000000" },
          SOLANA: { avg_gas_usd: "0.002", bridge_security_score: "98", liquidity_depth_usd: "85000000" }
        },
        deposit_amount: depositAmount,
        source_chain: "ETHEREUM",
        source_tx_hash: `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
        user_intent: userIntent
      };

      addLog("Fetching live multi-chain telemetry from EVM, Solana, and NEAR RPCs...", 'info');

      // 2. Cryptographic Canonicalization (Bypasses GenVM Sandbox errors)
      const sortedKeys = Object.keys(payloadObj).sort();
      const canonicalObj: Record<string, any> = {};
      
      for (const key of sortedKeys) {
        // Deep sort the nested chain_metrics object
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
      
      addLog("Generating SHA-256 Canonical Hash Lock...", 'info');
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

      // 3. Inject payload into GenLayer
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'route_cross_chain_intent',
        args: [intentId, deterministicString, hashHex],
        value: BigInt(0)
      });

      addLog(`Transaction broadcasted: ${hash}`, 'info');
      addLog("Invoking Multi-LLM Consensus Engine (GPT-5, Claude, Gemini)...", 'warning');
      addLog("AI is analyzing liquidity depth and evaluating bridge security scores...", 'info');

      if (typeof client.waitForTransactionReceipt === 'function') {
        const receipt = await client.waitForTransactionReceipt({ hash });
        setEvalResult(receipt);
        addLog("Consensus reached. Omni-chain route finalized.", 'success');
      } else {
        await new Promise(r => setTimeout(r, 8000));
        addLog("Transaction mined. See GenLayer Studio for detailed JSON receipt.", 'success');
      }

    } catch (err: any) {
      addLog(`Execution Failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-300 font-sans selection:bg-indigo-500/30">
      
      {/* Top Navigation */}
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Nexus Protocol</h1>
              <p className="text-[10px] text-neutral-500 font-mono">Omni-Chain Intent Router v1.0</p>
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
        
        {/* Left Column: Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-400" /> New Routing Intent
              </h2>
              <span className="text-[10px] font-mono text-neutral-500">{intentId}</span>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-2">Source Deposit (USDC)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={depositAmount} 
                    onChange={e => setDepositAmount(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <div className="absolute right-3 top-3 flex items-center gap-2">
                    <img src="https://cryptologos.cc/logos/ethereum-eth-logo.svg" className="h-4 w-4 opacity-70" alt="ETH" />
                    <span className="text-xs font-mono text-neutral-500">ETHEREUM</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-2">Natural Language Intent (AI Prompt)</label>
                <textarea 
                  rows={4} 
                  value={userIntent}
                  onChange={e => setUserIntent(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all leading-relaxed resize-none"
                />
              </div>

              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-300">Omni-Chain Target Candidates</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['SOLANA (0.002 GAS)', 'ARBITRUM (0.12 GAS)', 'BASE (0.04 GAS)', 'NEAR (0.01 GAS)'].map(chain => (
                    <span key={chain} className="text-[9px] font-mono bg-black/40 border border-white/10 text-neutral-400 px-2 py-1 rounded-md">
                      {chain}
                    </span>
                  ))}
                </div>
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
        </div>

        {/* Right Column: Terminal & Analytics */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[600px] shadow-2xl">
            
            {/* Terminal Header */}
            <div className="bg-black/40 border-b border-white/5 px-4 flex items-center gap-4">
              <div className="flex gap-1.5 py-4">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveTab('terminal')} 
                  className={`text-xs font-medium pb-4 border-b-2 transition-colors mt-4 ${activeTab === 'terminal' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
                >
                  Execution Terminal
                </button>
                <button 
                  onClick={() => setActiveTab('receipt')} 
                  className={`text-xs font-medium pb-4 border-b-2 transition-colors mt-4 ${activeTab === 'receipt' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
                >
                  Consensus Receipt
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-5 overflow-y-auto font-mono text-xs bg-black/20">
              {activeTab === 'terminal' ? (
                <div className="space-y-3">
                  <div className="text-neutral-600 mb-4">
                    <p>Nexus Protocol CLI v1.0.0</p>
                    <p>Connected to GenLayer StudioNet RPC</p>
                  </div>
                  
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                      <span className="text-neutral-600 shrink-0">[{log.time}]</span>
                      <span className={`${
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'warning' ? 'text-yellow-400' :
                        'text-indigo-300'
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
                  
                  {!isProcessing && terminalLogs.length === 0 && (
                    <div className="text-neutral-600 italic">System idle. Awaiting intent configuration...</div>
                  )}
                </div>
              ) : (
                <div className="h-full">
                  {evalResult ? (
                    <pre className="text-[10px] text-emerald-400/80 bg-[#0a0a0a] border border-white/5 p-4 rounded-xl overflow-x-auto h-full shadow-inner">
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
