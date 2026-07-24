/**
 * Helius API client — Enhanced Transactions (fund-flow), Solana JSON-RPC
 * (mint safety / holder concentration), and Wallet balances.
 *
 * Important honesty note: this gives you real fund-flow and on-chain data —
 * it does NOT do insider-cluster detection, wash-trading detection, or
 * wallet risk scoring. Flagging a wallet as suspicious is a much harder
 * problem that would need its own heuristics/ML on top of this data. We
 * deliberately never fabricate a "flagged" label here — every node from
 * this function comes back unflagged until real detection logic is built.
 */

import bs58 from "bs58";

const HELIUS_ENHANCED_BASE = "https://api-mainnet.helius-rpc.com/v0";
const HELIUS_WALLET_API_BASE = "https://api.helius.xyz/v1";

function heliusRpcUrl(apiKey: string) {
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}

async function heliusRpc<T>(
  method: string,
  params: unknown[],
  apiKey: string
): Promise<T | null> {
  try {
    const res = await fetch(heliusRpcUrl(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "solsight", method, params }),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`[helius] RPC ${method} failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const json = await res.json();
    if (json.error) {
      console.error(`[helius] RPC ${method} returned an error:`, json.error);
      return null;
    }
    return json.result as T;
  } catch (err) {
    console.error(`[helius] RPC ${method} threw:`, err);
    return null;
  }
}

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
    `${HELIUS_ENHANCED_BASE}/addresses/${address}/transactions?api-key=${apiKey}&limit=${limit}`,
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

export interface WalletHolding {
  mint: string;
  symbol: string | null;
  amount: number;
  usdValue: number | null;
}

export interface WalletBalanceSummary {
  solBalance: number;
  solUsdValue: number | null;
  tokenCount: number;
  totalUsdValue: number | null;
  topHoldings: WalletHolding[];
}

/**
 * Wallet balances, including USD values. This previously called
 * `${api-mainnet.helius-rpc.com}/v0/addresses/{address}/balances`, which is
 * not a real Helius endpoint — that RPC-style host only serves the
 * Enhanced Transactions API above. Helius's actual balances-with-USD-value
 * data lives on the separate Wallet API host (api.helius.xyz), which is
 * what this now calls. If Helius changes this response shape again, every
 * field below is read defensively (optional chaining + explicit fallback)
 * so a shape mismatch degrades to "Balance data unavailable" instead of
 * throwing — but the endpoint/host itself is the fix for the bug we had.
 */
export async function getWalletBalances(address: string): Promise<WalletBalanceSummary | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${HELIUS_WALLET_API_BASE}/wallet/${address}/balances?api-key=${apiKey}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    console.error(`[helius] getWalletBalances failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();

  const nativeLamports = data?.nativeBalance?.lamports ?? data?.nativeBalance ?? 0;
  const solBalance = Number(nativeLamports) / 1e9;
  const solUsdValue = typeof data?.nativeBalance?.usdValue === "number" ? data.nativeBalance.usdValue : null;

  const tokens: Array<Record<string, unknown>> = Array.isArray(data?.tokens) ? data.tokens : [];

  const topHoldings: WalletHolding[] = tokens
    .map((t) => ({
      mint: String(t.mint ?? ""),
      symbol: (t.symbol as string | undefined) ?? null,
      amount: Number(t.amount ?? 0),
      usdValue: typeof t.usdValue === "number" ? t.usdValue : null,
    }))
    .filter((t) => t.mint)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))
    .slice(0, 5);

  const tokensUsdTotal = tokens.reduce(
    (sum, t) => sum + (typeof t.usdValue === "number" ? t.usdValue : 0),
    0
  );
  const totalUsdValue =
    typeof data?.totalUsdValue === "number"
      ? data.totalUsdValue
      : solUsdValue !== null
        ? solUsdValue + tokensUsdTotal
        : null;

  return {
    solBalance,
    solUsdValue,
    tokenCount: tokens.length,
    totalUsdValue,
    topHoldings,
  };
}

export interface MintSafety {
  /** true = mint authority has been revoked (no one can mint more supply). null = couldn't be determined. */
  mintAuthorityRevoked: boolean | null;
  /** true = freeze authority has been revoked (no one can freeze holder accounts). null = couldn't be determined. */
  freezeAuthorityRevoked: boolean | null;
  /**
   * % of total supply held by the 10 largest token accounts on-chain.
   * Note: these are the largest *token accounts*, not necessarily 10
   * distinct human holders — a DEX pool's own account can appear here.
   * Still real on-chain data; just not perfectly deduplicated by owner.
   */
  topHolderPct: number | null;
}

/**
 * Real on-chain mint safety checks via Helius's Solana RPC — replaces the
 * "Unknown" placeholders for mint/freeze authority and holder concentration
 * with actual data read directly from the mint account.
 *
 * LP lock/burn status is deliberately NOT included here. Determining it
 * correctly requires first resolving which AMM pool holds the token's
 * liquidity (Raydium, Orca, Meteora, etc. each store this differently) and
 * then checking whether that specific pool's LP mint was burned or sent to
 * a locker contract — a meaningfully bigger feature on its own, not a
 * couple of RPC calls. Faking that field with a heuristic would violate
 * this project's real-data-only rule, so it stays "Unknown" until that
 * dedicated feature gets built.
 */
export async function getMintSafety(mintAddress: string): Promise<MintSafety> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return { mintAuthorityRevoked: null, freezeAuthorityRevoked: null, topHolderPct: null };
  }

  const [accountInfo, largestAccounts] = await Promise.all([
    heliusRpc<{ value: { data: { parsed: { info: Record<string, unknown> } } } | null }>(
      "getAccountInfo",
      [mintAddress, { encoding: "jsonParsed" }],
      apiKey
    ),
    heliusRpc<{ value: Array<{ amount: string }> }>(
      "getTokenLargestAccounts",
      [mintAddress],
      apiKey
    ),
  ]);

  const parsed = accountInfo?.value?.data?.parsed?.info;
  if (!parsed) {
    console.error(`[helius] getMintSafety: could not read mint account for ${mintAddress}`);
    return { mintAuthorityRevoked: null, freezeAuthorityRevoked: null, topHolderPct: null };
  }

  const mintAuthorityRevoked = parsed.mintAuthority === null;
  const freezeAuthorityRevoked = parsed.freezeAuthority === null;

  let topHolderPct: number | null = null;
  const supply = Number(parsed.supply);
  const accounts = largestAccounts?.value;
  if (accounts?.length && supply > 0) {
    const top10Sum = accounts.slice(0, 10).reduce((sum, a) => sum + Number(a.amount), 0);
    topHolderPct = Math.min(100, (top10Sum / supply) * 100);
  }

  return { mintAuthorityRevoked, freezeAuthorityRevoked, topHolderPct };
}

export interface RaydiumLpBurnResult {
  /** The pool's LP token mint address, decoded from raw on-chain account data. Included so this can be independently cross-checked (e.g. on Solscan) before being trusted. */
  lpMint: string | null;
  /** The LP mint's current total supply. Zero means every LP token has been burned — Dexscreener's own "padlock" badge is determined the same way. */
  lpSupply: number | null;
  lpBurned: boolean | null;
  /** Explains why a result couldn't be determined, for debugging. */
  note: string | null;
}

/**
 * Decodes a Raydium AMM v4 pool account to find its LP mint, then checks
 * whether that mint's supply is zero (fully burned).
 *
 * IMPORTANT — this uses a fixed byte offset (464) for the lpMint field
 * within Raydium's AMM v4 account layout, based on their commonly
 * referenced public struct layout. This has NOT been verified against a
 * live account from this environment (no network access to Solana RPC
 * here) — the returned `lpMint` is deliberately included in the result so
 * it can be manually cross-checked (e.g. does it show up as an LP token
 * for the right pool on Solscan?) before this is trusted anywhere near the
 * rug score. Raydium-only for now — other AMMs (Orca, Meteora, pump.fun's
 * bonding curve) use different account layouts and aren't supported here.
 */
export async function getRaydiumLpBurnStatus(pairAddress: string): Promise<RaydiumLpBurnResult> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return { lpMint: null, lpSupply: null, lpBurned: null, note: "HELIUS_API_KEY not set" };
  }

  const accountInfo = await heliusRpc<{
    value: { data: [string, string]; owner: string } | null;
  }>("getAccountInfo", [pairAddress, { encoding: "base64" }], apiKey);

  const raw = accountInfo?.value?.data?.[0];
  if (!raw) {
    return {
      lpMint: null,
      lpSupply: null,
      lpBurned: null,
      note: "Could not read pool account — may not be a Raydium AMM v4 pool",
    };
  }

  const buf = Buffer.from(raw, "base64");
  // Raydium AMM v4 state account is 752 bytes; lpMint is a 32-byte pubkey
  // starting at byte offset 464 (after status/config fields, baseVault,
  // quoteVault, baseMint, quoteMint).
  const LP_MINT_OFFSET = 464;
  if (buf.length < LP_MINT_OFFSET + 32) {
    return {
      lpMint: null,
      lpSupply: null,
      lpBurned: null,
      note: `Account too small (${buf.length} bytes) — likely not a Raydium AMM v4 pool`,
    };
  }

  const lpMintBytes = buf.subarray(LP_MINT_OFFSET, LP_MINT_OFFSET + 32);
  const lpMint = bs58.encode(lpMintBytes);

  const supplyResult = await heliusRpc<{ value: { amount: string; uiAmount: number | null } }>(
    "getTokenSupply",
    [lpMint],
    apiKey
  );

  const uiAmount = supplyResult?.value?.uiAmount;
  if (uiAmount === undefined || uiAmount === null) {
    return {
      lpMint,
      lpSupply: null,
      lpBurned: null,
      note: "Decoded an lpMint but couldn't read its supply — decoded address may be wrong",
    };
  }

  return { lpMint, lpSupply: uiAmount, lpBurned: uiAmount === 0, note: null };
}