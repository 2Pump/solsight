/**
 * Helius Enhanced Transactions API client.
 * Docs: https://docs.helius.dev/solana-apis/enhanced-transactions-api
 *
 * This powers the wallet deep-dive page: we pull a wallet's recent parsed
 * transactions, extract token/SOL transfers, and aggregate them into a
 * fund-flow graph (who this wallet sent to / received from, how often).
 *
 * Important honesty note: this gives you real fund-flow data — it does NOT
 * do insider-cluster detection, wash-trading detection, or wallet risk
 * scoring. Flagging a wallet as suspicious is a much harder problem that
 * would need its own heuristics/ML on top of this data. We deliberately
 * never fabricate a "flagged" label here — every node from this function
 * comes back unflagged until real detection logic is built.
 */

const HELIUS_BASE = "https://api-mainnet.helius-rpc.com/v0";

interface HeliusTokenTransfer {
  fromUserAccount: string | null;
  toUserAccount: string | null;
  tokenAmount: number;
  mint: string;
}

interface HeliusNativeTransfer {
  fromUserAccount: string | null;
  toUserAccount: string | null;
  amount: number; // lamports
}

interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
}

export interface FundFlowEdge {
  counterparty: string;
  txCount: number;
  /** Relative interaction volume vs. this wallet's other counterparties, 0-100. Not a USD or balance figure. */
  relativeVolume: number;
}

export async function getWalletFundFlow(
  address: string,
  limit = 40
): Promise<{ edges: FundFlowEdge[]; txCount: number }> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return { edges: [], txCount: 0 };

  const res = await fetch(
    `${HELIUS_BASE}/addresses/${address}/transactions?api-key=${apiKey}&limit=${limit}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) {
    console.error(`[helius] getWalletFundFlow failed: ${res.status} ${res.statusText}`);
    return { edges: [], txCount: 0 };
  }

  const transactions: HeliusTransaction[] = await res.json();

  // counterparty address -> { txCount, volume } — volume is a unitless
  // score (SOL lamports + token-amount magnitude), used only to rank
  // counterparties relative to each other, never shown as a dollar figure.
  const counterparties = new Map<string, { txCount: number; volume: number }>();

  function record(counterparty: string | null, amount: number) {
    if (!counterparty || counterparty === address) return;
    const existing = counterparties.get(counterparty) ?? { txCount: 0, volume: 0 };
    existing.txCount += 1;
    existing.volume += Math.abs(amount);
    counterparties.set(counterparty, existing);
  }

  for (const tx of transactions) {
    for (const t of tx.tokenTransfers ?? []) {
      if (t.fromUserAccount === address) record(t.toUserAccount, t.tokenAmount);
      if (t.toUserAccount === address) record(t.fromUserAccount, t.tokenAmount);
    }
    for (const t of tx.nativeTransfers ?? []) {
      if (t.fromUserAccount === address) record(t.toUserAccount, t.amount / 1e9);
      if (t.toUserAccount === address) record(t.fromUserAccount, t.amount / 1e9);
    }
  }

  const maxVolume = Math.max(1, ...Array.from(counterparties.values()).map((c) => c.volume));

  const edges: FundFlowEdge[] = Array.from(counterparties.entries())
    .map(([counterparty, data]) => ({
      counterparty,
      txCount: data.txCount,
      relativeVolume: Math.round((data.volume / maxVolume) * 100),
    }))
    .sort((a, b) => b.relativeVolume - a.relativeVolume)
    .slice(0, 8); // cap to keep the graph readable

  return { edges, txCount: transactions.length };
}

export interface WalletBalanceSummary {
  solBalance: number;
  tokenCount: number;
}

export async function getWalletBalances(address: string): Promise<WalletBalanceSummary | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${HELIUS_BASE}/addresses/${address}/balances?api-key=${apiKey}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    console.error(`[helius] getWalletBalances failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  return {
    solBalance: (data.nativeBalance ?? 0) / 1e9,
    tokenCount: Array.isArray(data.tokens) ? data.tokens.length : 0,
  };
}