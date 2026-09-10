import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import LandingSections from "@/components/landing/LandingSections";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingSocial from "@/components/landing/LandingSocial";
import LandingFooter from "@/components/landing/LandingFooter";
import { useEffect } from "react";

export default function Landing() {
  const isPreview = new URLSearchParams(window.location.search).get("view") === "1";

  useEffect(() => {
    // Only the real root landing establishes a first visit. The authenticated
    // /landing?view=1 preview must never change first-visit state.
    if (isPreview) return;
    try {
      localStorage.setItem("vardin_site_visited", "1");
    } catch {
      // If storage is unavailable, the app still renders normally.
    }
  }, [isPreview]);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav preview={isPreview} />
      <LandingHero preview={isPreview} />
      <LandingSections />
      <LandingPricing preview={isPreview} />
      <LandingSocial preview={isPreview} />
      <LandingFooter />
    </div>
  );
}