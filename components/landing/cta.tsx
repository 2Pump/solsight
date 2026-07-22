"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Cta() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass glow-violet relative overflow-hidden px-8 py-16 text-center sm:px-16"
        >
          <div className="pointer-events-none absolute inset-0 bg-aurora opacity-60" />
          <div className="relative">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Your radar is idle. Turn it on.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-ink-muted">
              Connect a wallet or sign in with Discord — free, open-source,
              no card required.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Launch App <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="https://github.com/solsight/solsight" target="_blank">
                  View source on GitHub
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
