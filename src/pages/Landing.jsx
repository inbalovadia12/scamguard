import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import LandingSections from "@/components/landing/LandingSections";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingSocial from "@/components/landing/LandingSocial";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Landing() {
  const isPreview = new URLSearchParams(window.location.search).get("view") === "1";

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