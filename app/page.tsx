import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { FeedPreview } from "@/components/landing/feed-preview";
import { Cta } from "@/components/landing/cta";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <FeedPreview />
      <Cta />
    </>
  );
}
