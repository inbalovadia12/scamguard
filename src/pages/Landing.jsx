import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import LandingSections from "@/components/landing/LandingSections";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingSocial from "@/components/landing/LandingSocial";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <LandingHero />
      <LandingSections />
      <LandingPricing />
      <LandingSocial />
      <LandingFooter />
    </div>
  );
}