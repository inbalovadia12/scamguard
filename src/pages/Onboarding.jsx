import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck, ArrowRight, ArrowLeft, Check, Users, Bell, Bot, Zap, Heart,
  Target, ShoppingBag, MessageSquare, Briefcase, Mail, Lock, Sparkles, PartyPopper,
  UserPlus, Loader2,
} from "lucide-react";
import confetti from "canvas-confetti";

const goals = [
  { id: "personal", label: "Personal Use", icon: ShieldCheck, description: "Detect and avoid scams targeting me" },
  { id: "family", label: "Family Protection", icon: Users, description: "Keep my parents, kids, and loved ones safe" },
  { id: "shopping", label: "Online Shopping", icon: ShoppingBag, description: "Verify marketplace listings before buying" },
  { id: "marketplace", label: "Marketplace Transactions", icon: Briefcase, description: "Check buyers and sellers for scams" },
  { id: "social", label: "Social Media", icon: MessageSquare, description: "Spot fake profiles and social engineering" },
  { id: "business", label: "Business Communications", icon: Mail, description: "Verify business emails and offers" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [alertPref, setAlertPref] = useState("all");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [privacyAutoRedact, setPrivacyAutoRedact] = useState(true);
  const [familyEmails, setFamilyEmails] = useState([""]);
  const [inviting, setInviting] = useState(false);

  const toggleGoal = (id) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    try {
      await base44.auth.updateMe({
        onboarding_completed: true,
        onboarding_goals: selectedGoals,
        alert_preference: alertPref,
        notify_email: notifyEmail,
        privacy_auto_redact: privacyAutoRedact,
      });
    } catch (e) {
      // Non-blocking
    }
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } }), 200);
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } }), 400);
    setStep(5);
  };

  const handleInviteFamily = async () => {
    const user = await base44.auth.me();
    const emails = familyEmails.filter((e) => e.trim());
    setInviting(true);
    for (const email of emails) {
      try {
        await base44.entities.ProtectedSenior.create({
          name: email.split("@")[0],
          email: email.trim(),
          guardian_id: user.id,
          consent_given: false,
          alert_preference: alertPref,
        });
        try {
          await base44.integrations.Core.SendEmail({
            to: email.trim(),
            subject: `${user.full_name || "Someone"} invited you to join Vardin`,
            body: `Hi,\n\n${user.full_name || "Your family member"} has invited you to join their Vardin family protection circle. Vardin is an AI-powered scam detection tool that helps you know what's real before you click.\n\nTo accept this invitation and start protecting each other from scams, create your free Vardin account at ${window.location.origin}/register\n\nStay safe,\nThe Vardin Team`,
          });
        } catch (emailErr) {
          console.error("Failed to send invite to", email, emailErr);
        }
      } catch (e) { /* skip duplicates */ }
    }
    setInviting(false);
    setStep(4);
  };

  const steps = [
    { component: <WelcomeStep onNext={() => setStep(1)} />, canSkip: false },
    { component: <GoalStep selectedGoals={selectedGoals} toggleGoal={toggleGoal} onNext={() => setStep(2)} onBack={() => setStep(0)} />, canSkip: true },
    { component: <PreferencesStep alertPref={alertPref} setAlertPref={setAlertPref} notifyEmail={notifyEmail} setNotifyEmail={setNotifyEmail} privacyAutoRedact={privacyAutoRedact} setPrivacyAutoRedact={setPrivacyAutoRedact} onNext={() => setStep(3)} onBack={() => setStep(1)} />, canSkip: true },
    { component: <InviteFamilyStep emails={familyEmails} setEmails={setFamilyEmails} onNext={handleInviteFamily} onBack={() => setStep(2)} inviting={inviting} />, canSkip: true },
    { component: <ChoosePlanStep onComplete={handleComplete} onBack={() => setStep(3)} />, canSkip: true },
    { component: <CompletionStep onDone={() => navigate("/dashboard")} />, canSkip: false },
  ];

  const progress = ((step + 1) / steps.length) * 100;
  const isLastStep = step === steps.length - 1;

  const skip = () => {
    if (step < steps.length - 2) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight font-heading">Vardin</span>
          </div>
          {!isLastStep && steps[step].canSkip && (
            <button onClick={skip} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Skip
            </button>
          )}
        </div>

        {!isLastStep && (
          <div className="w-full h-1.5 bg-muted rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="flex-1 flex items-center justify-center">
          {steps[step].component}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }) {
  return (
    <div className="text-center space-y-6 animate-fade-in">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/20">
        <ShieldCheck className="w-10 h-10 text-primary-foreground" />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight font-heading">Welcome to Vardin</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto text-balance">
          Your AI-powered shield against digital scams. Let's set up your account to get the most out of Vardin.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto py-4">
        {[
          { icon: Zap, text: "Instant Analysis" },
          { icon: Users, text: "Family Protection" },
          { icon: Bot, text: "AI Expert Chat" },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-card">
            <item.icon className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium text-center">{item.text}</span>
          </div>
        ))}
      </div>
      <Button onClick={onNext} size="lg" className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
        Get Started
        <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

function GoalStep({ selectedGoals, toggleGoal, onNext, onBack }) {
  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Target className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">What do you want to protect?</h1>
        <p className="text-muted-foreground max-w-md mx-auto">Select all that apply. We'll personalize your experience.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {goals.map((goal) => {
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <button key={goal.id} onClick={() => toggleGoal(goal.id)}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/50 bg-card hover:border-border hover:bg-muted/50"
              }`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <goal.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{goal.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{goal.description}</div>
              </div>
              {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        <Button onClick={onNext} className="bg-gradient-to-r from-primary to-primary/80">Continue<ArrowRight className="w-4 h-4 ml-1" /></Button>
      </div>
    </div>
  );
}

function PreferencesStep({ alertPref, setAlertPref, notifyEmail, setNotifyEmail, privacyAutoRedact, setPrivacyAutoRedact, onNext, onBack }) {
  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bell className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Your Preferences</h1>
        <p className="text-muted-foreground max-w-md mx-auto">Customize how Vardin keeps you informed and protected.</p>
      </div>
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-border/50 bg-card space-y-3">
          <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Alert Preferences</span></div>
          <div className="grid grid-cols-3 gap-2">
            {[{ v: "all", l: "All alerts" }, { v: "high_risk_only", l: "High risk only" }, { v: "financial_only", l: "Financial only" }].map((opt) => (
              <button key={opt.v} onClick={() => setAlertPref(opt.v)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${alertPref === opt.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border/50 bg-card space-y-3">
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Notifications</span></div>
          <button onClick={() => setNotifyEmail(!notifyEmail)} className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">Email notifications for family alerts</span>
            <div className={`w-10 h-6 rounded-full transition-colors ${notifyEmail ? "bg-primary" : "bg-muted"}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifyEmail ? "translate-x-4" : "translate-x-0.5"} mt-0.5`} />
            </div>
          </button>
        </div>
        <div className="p-4 rounded-xl border border-border/50 bg-card space-y-3">
          <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Privacy Options</span></div>
          <button onClick={() => setPrivacyAutoRedact(!privacyAutoRedact)} className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">Auto-redact phone numbers & wallets in stored messages</span>
            <div className={`w-10 h-6 rounded-full transition-colors ${privacyAutoRedact ? "bg-primary" : "bg-muted"}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${privacyAutoRedact ? "translate-x-4" : "translate-x-0.5"} mt-0.5`} />
            </div>
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        <Button onClick={onNext} className="bg-gradient-to-r from-primary to-primary/80">Continue<ArrowRight className="w-4 h-4 ml-1" /></Button>
      </div>
    </div>
  );
}

function InviteFamilyStep({ emails, setEmails, onNext, onBack, inviting }) {
  const addEmail = () => setEmails([...emails, ""]);
  const updateEmail = (i, val) => setEmails(emails.map((e, idx) => idx === i ? val : e));
  const removeEmail = (i) => setEmails(emails.filter((_, idx) => idx !== i));

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Invite Family Members</h1>
        <p className="text-muted-foreground max-w-md mx-auto">Add loved ones you'd like to protect. We'll send them an email invitation.</p>
      </div>
      <div className="space-y-3">
        {emails.map((email, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={email} onChange={(e) => updateEmail(i, e.target.value)} type="email" placeholder="family@example.com" className="h-11" />
            {emails.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeEmail(i)} className="flex-shrink-0"><ArrowLeft className="w-4 h-4 rotate-45" /></Button>
            )}
          </div>
        ))}
        <Button variant="outline" onClick={addEmail} className="w-full gap-2"><UserPlus className="w-4 h-4" />Add another</Button>
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        <Button onClick={onNext} disabled={inviting} className="bg-gradient-to-r from-primary to-primary/80">
          {inviting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending...</> : <>Continue<ArrowRight className="w-4 h-4 ml-1" /></>}
        </Button>
      </div>
    </div>
  );
}

function ChoosePlanStep({ onComplete, onBack }) {
  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Choose a Plan</h1>
        <p className="text-muted-foreground max-w-md mx-auto">Start free and upgrade anytime. Plus is recommended for most users.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { name: "Starter", price: "$0", icon: ShieldCheck, features: "10 analyses/mo", highlight: false },
          { name: "Plus", price: "$40", icon: Zap, features: "100 analyses/mo", highlight: true },
          { name: "Premium", price: "$80", icon: Sparkles, features: "250 analyses/mo", highlight: false },
        ].map((plan) => (
          <div key={plan.name} className={`p-4 rounded-xl border text-center transition-all ${plan.highlight ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/50 bg-card"}`}>
            {plan.highlight && <div className="text-xs font-bold text-primary mb-1">RECOMMENDED</div>}
            <plan.icon className={`w-6 h-6 mx-auto mb-2 ${plan.highlight ? "text-primary" : "text-muted-foreground"}`} />
            <div className="font-bold text-sm font-heading">{plan.name}</div>
            <div className="text-lg font-bold font-heading">{plan.price}</div>
            <div className="text-xs text-muted-foreground">{plan.features}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        <Button onClick={onComplete} className="bg-gradient-to-r from-primary to-primary/80"><Check className="w-4 h-4 mr-1" />Complete Setup</Button>
      </div>
    </div>
  );
}

function CompletionStep({ onDone }) {
  return (
    <div className="text-center space-y-6 animate-bounce-in">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/20">
        <PartyPopper className="w-10 h-10 text-primary-foreground" />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight font-heading">You're All Set!</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto text-balance">
          Your Vardin account is ready. Here's our recommendation for your first step:
        </p>
      </div>
      <div className="max-w-sm mx-auto p-5 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-3 text-left">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="font-semibold text-sm">Analyze your first message</div>
          <div className="text-xs text-muted-foreground mt-0.5">Paste any suspicious message and get an instant AI risk assessment.</div>
        </div>
      </div>
      <Button onClick={onDone} size="lg" className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
        Go to Dashboard
        <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}