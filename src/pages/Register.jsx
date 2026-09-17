import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, Gift, AlertTriangle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import AppleIcon from "@/components/AppleIcon";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();

  // Capture a referral code from ?ref= so it can be attributed after login
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref") || params.get("referral") || "";
      const stored = localStorage.getItem("vardin_ref") || "";
      const pending = ref || stored;
      if (pending) {
        localStorage.setItem("vardin_ref", pending);
        setReferralCode(pending.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      }
    } catch {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!legalAccepted) {
      setError("Please review and accept the Terms of Service and AI limitations before creating your account.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }

      const pendingReferral = referralCode.trim() || localStorage.getItem("vardin_ref") || "";
      if (pendingReferral) {
        try {
          await base44.functions.invoke("claimReferralCode", { code: pendingReferral });
          localStorage.removeItem("vardin_ref");
        } catch (referralError) {
          console.warn("Referral could not be applied after verification:", referralError);
        }
      }
      
      // Wait for auth context to update before redirecting
      await checkUserAuth();
      
      // Give it a moment to ensure state is updated
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 100);
    } catch (err) {
      setError(err.message || "Invalid verification code");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = () => {
    if (!legalAccepted) {
      setError("Please review and accept the Terms of Service and AI limitations first.");
      return;
    }
    try {
      const code = referralCode.trim();
      if (code) localStorage.setItem("vardin_ref", code);
    } catch {}
    base44.auth.loginWithProvider("google", "/dashboard");
  };

  const handleApple = () => {
    if (!legalAccepted) {
      setError("Please review and accept the Terms of Service and AI limitations first.");
      return;
    }
    try {
      const code = referralCode.trim();
      if (code) localStorage.setItem("vardin_ref", code);
    } catch {}
    base44.auth.loginWithProvider("apple", "/dashboard");
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a code to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-start gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20">
        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vardin is in <strong>beta</strong>. Features may change or be limited, and AI scam-detection results can be inaccurate or incomplete. Always independently verify important information — do not rely solely on Vardin for high-stakes decisions.
        </p>
      </div>
      <div className="space-y-3 mb-6">
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={handleGoogle}
        >
          <GoogleIcon className="w-5 h-5 mr-2" />
          Continue with Google
        </Button>
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={handleApple}
        >
          <AppleIcon className="w-5 h-5 mr-2" />
          Continue with Apple
        </Button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="referral-code">Referral code <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <div className="relative">
            <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="referral-code"
              type="text"
              autoComplete="off"
              placeholder="VARDINXXXXXXX"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              className="pl-10 h-12 font-mono tracking-wider"
              maxLength={13}
            />
          </div>
          <p className="text-xs text-muted-foreground">Enter a friend's code so the referral is linked to your account.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <label className="flex items-start gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20 cursor-pointer">
          <input
            type="checkbox"
            checked={legalAccepted}
            onChange={(e) => setLegalAccepted(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded accent-primary flex-shrink-0"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I agree to the <Link to="/terms" className="text-primary font-medium hover:underline" target="_blank">Terms of Service</Link> and understand that Vardin's AI analyses are automated predictions that may be inaccurate or incomplete. I will independently verify important information and will not rely solely on Vardin for financial, legal, medical, security, or other high-stakes decisions.
          </span>
        </label>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading || !legalAccepted}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}