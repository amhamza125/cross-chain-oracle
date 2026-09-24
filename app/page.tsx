'use client';

import { useState } from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { custom } from 'viem';

// Pre-configured test scenarios for the AI Auditor
const TEST_SCENARIOS = [
  {
    name: "Valid Lock (100 USDC)",
    description: "Standard verified lockbox deposit on Ethereum Sepolia.",
    txHash: "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060",
    data: {
      blockNumber: "5120344",
      confirmations: "65",
      from: "0x71C...38A4",
      to: "0xBridgeLockBox_USDC",
      value: "100000000",
      asset: "USDC",
      status: "1"
    }
  },
  {
    name: "Reverted EVM Tx (Failed)",
    description: "Transaction failed on Ethereum (status 0). AI should reject it.",
    txHash: "0x8a109bf31ec5a420b9e8471180ad77218ef86bca09a96e21074a382104ad91ff",
    data: {
      blockNumber: "5120380",
      confirmations: "12",
      from: "0x71C...38A4",
      to: "0xBridgeLockBox_USDC",
      value: "100000000",
      asset: "USDC",
      status: "0"
    }
  },
  {
    name: "Malicious Zero-Transfer Attack",
    description: "Attacker attempts to trigger bridge with 0 value locked.",
    txHash: "0x12fa90b24dc68a0119cbf02830ad61172aa982103ef89021703ad982104bf801",
    data: {
      blockNumber: "5120401",
      confirmations: "4",
      from: "0xAttacker_Node_99",
      to: "0xBridgeLockBox_USDC",
      value: "0",
      asset: "USDC",
      status: "1"
    }
  }
];

export default function CrossChainOracleUI() {
  const [userAddress, setUserAddress] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  
  const [selectedScenario, setSelectedScenario] = useState(TEST_SCENARIOS[0]);
  const [evmTxHash, setEvmTxHash] = useState(TEST_SCENARIOS[0].txHash);
  const [txPayload, setTxPayload] = useState(JSON.stringify(TEST_SCENARIOS[0].data, null, 2));
  
  const [canonicalJson, setCanonicalJson] = useState('');
  const [expectedHash, setExpectedHash] = useState('');
  
  const [isPreparing, setIsPreparing] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  
  const [txHash, setTxHash] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [evalResult, setEvalResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const connectWallet = async () => {
    setErrorMsg('');
    if (typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined') {
      try {
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        setUserAddress(accounts[0]);
      } catch (err: any) {
        setErrorMsg(`Wallet connection failed: ${err.message}`);
      }
    } else {
      setErrorMsg("No Web3 wallet found. Please open this page in MetaMask.");
    }
  };

  const getClient = async () => {
    if (!userAddress) {
      throw new Error("Wallet not connected.");
    }
    
    const client = createClient({
      chain: studionet,
      account: userAddress as `0x${string}`,
      transport: custom((window as any).ethereum)
    } as any);

    if (typeof client.connect === 'function') {
      await client.connect("studionet");
    }
    
    return client;
  };

  const handleScenarioChange = (scenario: typeof TEST_SCENARIOS[0]) => {
    setSelectedScenario(scenario);
    setEvmTxHash(scenario.txHash);
    setTxPayload(JSON.stringify(scenario.data, null, 2));
    setCanonicalJson('');
    setExpectedHash('');
    setErrorMsg('');
  };

  const preparePayload = async () => {
    setErrorMsg('');
    setIsPreparing(true);
    setCanonicalJson('');
    setExpectedHash('');

    try {
      if (!evmTxHash || !evmTxHash.startsWith('0x')) {
        throw new Error("Please enter a valid EVM Transaction Hash starting with 0x.");
      }

      let parsed: Record<string, any>;
      try {
        parsed = JSON.parse(txPayload);
      } catch (e) {
        throw new Error("Invalid JSON format in the transaction payload box.");
      }

      const sortedKeys = Object.keys(parsed).sort();
      const canonicalObject: Record<string, string> = {};
      for (const key of sortedKeys) {
        canonicalObject[key] = String(parsed[key]);
      }

      const deterministicString = JSON.stringify(canonicalObject);
      const msgBuffer = new TextEncoder().encode(deterministicString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      setCanonicalJson(deterministicString);
      setExpectedHash(hashHex);
    } catch (err: any) {
      setErrorMsg(`Preparation Error: ${err.message}`);
    } finally {
      setIsPreparing(false);
    }
  };

  const executeBridge = async () => {
    setErrorMsg('');
    setTxHash('');
    setTxStatus('Initializing transaction...');
    setEvalResult(null);

    if (!contractAddress || !contractAddress.startsWith('0x')) {
      setErrorMsg("Please enter your deployed GenLayer CrossChainOracle contract address at the top.");
      return;
    }

    if (!canonicalJson || !expectedHash) {
      setErrorMsg("Please click 'Lock & Generate Cryptographic Hash' first.");
      return;
    }

    try {
      setIsBridging(true);
      setTxStatus('Connecting to GenLayer network...');
      const client = await getClient();

      setTxStatus('Please sign the transaction in MetaMask...');
      
      const hash = await client.writeContract({
        address: contractAddress as `0x${string}`,
        functionName: 'verify_and_bridge',
        args: [evmTxHash, canonicalJson, expectedHash],
        value: BigInt(0)
      });

      setTxHash(hash);
      setTxStatus('Broadcasting. Awaiting Multi-LLM AI Security Audit...');

      if (typeof client.waitForTransactionReceipt === 'function') {
        const receipt = await client.waitForTransactionReceipt({ hash });
        setEvalResult(receipt);
        setTxStatus('Consensus finalized!');
      } else {
        await new Promise((resolve) => setTimeout(resolve, 8000));
        setTxStatus('Transaction broadcasted. Check GenLayer Studio for detailed consensus trace.');
      }
    } catch (err: any) {
      setErrorMsg(`Bridge Execution Failed: ${err.message || err}`);
      setTxStatus('Execution Error');
    } finally {
      setIsBridging(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <header className="border-b border-neutral-800 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">GenLayer Cross-Chain AI Oracle</h1>
            <p className="text-xs text-neutral-400 mt-1">Multi-LLM Consensus Auditor & Cryptographic Push Relayer</p>
          </div>
          <div>
            {!userAddress ? (
              <button onClick={connectWallet} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition">
                Connect Wallet
              </button>
            ) : (
              <div className="bg-neutral-900 border border-blue-900 text-blue-300 text-xs px-3 py-2 rounded-lg font-mono">
                {userAddress.substring(0, 6)}...{userAddress.slice(-4)}
              </div>
            )}
          </div>
        </header>

        {errorMsg && (
          <div className="bg-red-950/70 border border-red-800 text-red-200 p-4 rounded-xl text-xs font-mono break-all space-y-1">
            <p className="font-bold text-red-400">Error Notification</p>
            <p>{errorMsg}</p>
          </div>
        )}

        <section className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl space-y-2">
          <label className="text-xs font-semibold text-neutral-300 block">GenLayer CrossChainOracle Contract Address:</label>
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value.trim())}
            placeholder="0x... (Paste your newly deployed contract address from GenLayer Studio)"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-100 font-mono focus:border-blue-500 focus:outline-none"
          />
        </section>

        <section className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl space-y-4">
          <div>
            <h2 className="text-sm font-bold text-neutral-200">1. Select EVM Test Scenario</h2>
            <p className="text-xs text-neutral-400">Choose a preset or customize the fields below to test the AI security auditor.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TEST_SCENARIOS.map((scenario) => (
              <button
                key={scenario.name}
                onClick={() => handleScenarioChange(scenario)}
                className={`p-3 text-left rounded-lg border transition text-xs flex flex-col justify-between ${
                  selectedScenario.name === scenario.name
                    ? 'border-blue-500 bg-blue-950/30 text-blue-200'
                    : 'border-neutral-800 bg-neutral-950/50 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div>
                  <span className="font-bold block text-neutral-200">{scenario.name}</span>
                  <span className="text-[11px] text-neutral-400 mt-1 block">{scenario.description}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">EVM Transaction Hash:</label>
              <input type="text" value={evmTxHash} onChange={(e) => { setEvmTxHash(e.target.value.trim()); setCanonicalJson(''); setExpectedHash(''); }} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-300 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Raw Transaction Payload (JSON):</label>
              <textarea rows={7} value={txPayload} onChange={(e) => { setTxPayload(e.target.value); setCanonicalJson(''); setExpectedHash(''); }} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-300 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          <button onClick={preparePayload} disabled={isPreparing} className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 py-2.5 rounded-lg text-xs font-bold transition disabled:opacity-50">
            {isPreparing ? 'Computing SHA-256 Hash...' : 'Lock & Generate Cryptographic Hash'}
          </button>
        </section>

        {canonicalJson && expectedHash && (
          <section className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-bold text-emerald-400">2. Cryptographic Hash Lock Ready</h2>
            <div className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 text-xs font-mono space-y-2 text-neutral-300">
              <div><span className="text-neutral-500 block">Deterministic Canonical Payload:</span><span className="text-blue-300 break-all">{canonicalJson}</span></div>
              <div><span className="text-neutral-500 block">SHA-256 Hash Lock:</span><span className="text-emerald-400 break-all">{expectedHash}</span></div>
            </div>
            <button onClick={executeBridge} disabled={isBridging || !userAddress} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg text-xs font-bold transition disabled:opacity-50">
              {isBridging ? 'Executing Multi-LLM Audit on GenLayer...' : 'Relay to GenLayer & Execute AI Audit'}
            </button>
          </section>
        )}

        {(txHash || txStatus) && (
          <section className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl space-y-3 text-xs font-mono">
            <h2 className="text-sm font-bold text-neutral-200 font-sans">3. Transaction Status</h2>
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-2 text-neutral-300">
              <p><span className="text-neutral-500">Status: </span><span className="text-amber-400 font-semibold">{txStatus}</span></p>
              {txHash && <p><span className="text-neutral-500">Tx Hash: </span><span className="text-neutral-200 break-all">{txHash}</span></p>}
              {evalResult && (
                <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                  <p className="text-emerald-400 font-bold font-sans">Consensus Audit Receipt:</p>
                  <pre className="text-[10px] text-neutral-400 overflow-x-auto bg-neutral-900 p-3 rounded-lg border border-neutral-800">
                    {JSON.stringify(evalResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
