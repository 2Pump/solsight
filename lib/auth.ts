import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { prisma } from "@/lib/prisma";

/**
 * Wallet sign-in works like Sign-In-With-Ethereum, adapted for Solana:
 * the client asks the wallet to sign a one-time message, then this
 * Credentials provider verifies the signature against the public key
 * before creating/linking a session.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/auth" },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
    Credentials({
      id: "solana",
      name: "Solana Wallet",
      credentials: {
        address: { label: "Address", type: "text" },
        signature: { label: "Signature", type: "text" },
        message: { label: "Message", type: "text" },
      },
      async authorize(credentials) {
        const address = credentials?.address as string;
        const signature = credentials?.signature as string;
        const message = credentials?.message as string;
        if (!address || !signature || !message) return null;

        try {
          const publicKey = new PublicKey(address);
          // The client encodes the signature with bs58 (standard Solana
          // convention — matches how addresses themselves are encoded),
          // NOT base64. Decoding with the wrong scheme here silently
          // produces garbage bytes instead of throwing, so verification
          // would fail for every single sign-in attempt without ever
          // surfacing why — this was the actual bug.
          const verified = nacl.sign.detached.verify(
            new TextEncoder().encode(message),
            bs58.decode(signature),
            publicKey.toBytes()
          );
          if (!verified) return null;
        } catch {
          return null;
        }

        const user = await prisma.user.upsert({
          where: { walletAddress: address },
          update: {},
          create: { walletAddress: address, name: `${address.slice(0, 4)}…${address.slice(-4)}` },
        });

        return { id: user.id, name: user.name, walletAddress: user.walletAddress };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.walletAddress = (user as { walletAddress?: string }).walletAddress;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub;
        (session.user as { walletAddress?: string }).walletAddress =
          token.walletAddress as string | undefined;
      }
      return session;
    },
  },
});
