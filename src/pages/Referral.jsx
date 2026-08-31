import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Gift, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const normalizeCode = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export default function Referral() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => normalizeCode(params.get("code") || ""));
  const [error, setError] = useState("");

  const continueToSignup = (event) => {
    event.preventDefault();
    const normalized = normalizeCode(code);
    if (normalized.length < 8) {
      setError("Enter the referral code your friend shared with you.");
      return;
    }
    navigate(`/register?referral=${encodeURIComponent(normalized)}`);
  };

  return (
    <AuthLayout
      icon={Gift}
      title="Join with a referral"
      subtitle="Enter a friend's referral code before creating your account."
      footer={<><Link to="/register" className="text-primary font-medium hover:underline">Continue without a code</Link></>}
    >
      <form onSubmit={continueToSignup} className="space-y-5">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          Your friend earns a monthly credit bonus after you activate a paid plan.
        </div>
        <div className="space-y-2">
          <Label htmlFor="referral-code">Referral code</Label>
          <Input
            id="referral-code"
            value={code}
            onChange={(event) => setCode(normalizeCode(event.target.value))}
            placeholder="VARDINXXXXXXX"
            autoComplete="off"
            className="h-12 font-mono tracking-wider uppercase"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full h-12 gap-2">
          Continue to sign up <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
    </AuthLayout>
  );
}