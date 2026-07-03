import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import LandingSections from "@/components/landing/LandingSections";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingSocial from "@/components/landing/LandingSocial";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.isAuthenticated().then((authed) => {
      if (authed) navigate("/dashboard", { replace: true });
    }).catch(() => {});
  }, [navigate]);

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