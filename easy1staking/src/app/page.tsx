import { Hero } from "@/components/site/Hero";
import { PoolStatsStrip } from "@/components/site/PoolStatsStrip";
import { ContributionGrid } from "@/components/site/ContributionGrid";
import { DelegatePanel } from "@/components/site/DelegatePanel";

export default function Home() {
  return (
    <main>
      <Hero />
      <ContributionGrid />
      <PoolStatsStrip />
      <DelegatePanel />
    </main>
  );
}
