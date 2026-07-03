import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Shield, ArrowRight, ArrowLeft, Check, Users, Bell, Bot, Puzzle,
  Search, Zap, Heart, Target, TrendingUp,
} from "lucide-react";

const goals = [
  { id: "protect_self", label: "Protect Myself", icon: Shield, description: "Detect and avoid scams targeting me personally" },
  { id: "protect_family", label: "Protect My Family", icon: Users, description: "Keep my parents, kids, and loved ones safe" },
  { id: "learn_scams", label: "Learn About Scams", icon: Search, description: "Understand how scammers work and stay educated" },
  { id: "realtime_alerts", label: "Real-Time Alerts", icon: Bell, description: "Get notified the moment a family member is targeted" },
  { id: "ai_assistant", label: "AI Assistant", icon: Bot, description: "Chat with an AI expert whenever I'm unsure" },
  { id: "browser_protection", label: "Browser Protection", icon: Puzzle, description: "Analyze messages directly from my browser" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState([]);

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
      });
    } catch (e) {
      // Non-blocking — user can still proceed
    }
    navigate("/");
  };

  const steps = [
    <WelcomeStep key="welcome" onNext={() => setStep(1)} />,
    <GoalStep
      key="goals"
      selectedGoals={selectedGoals}
      toggleGoal={toggleGoal}
      onNext={() => setStep(2)}
      onBack={() => setStep(0)}
    />,
    <RecommendationsStep
      key="recs"
      selectedGoals={selectedGoals}
      onComplete={handleComplete}
      onBack={() => setStep(1)}
    />,
  ];

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">ScamGuard</span>
          </div>
          <button
            onClick={handleComplete}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        </div>

        <div className="w-full h-1.5 bg-muted rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex-1 flex items-center justify-center">
          {steps[step]}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }) {
  return (
    <div className="text-center space-y-6 animate-fade-in">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/20">
        <Shield className="w-10 h-10 text-primary-foreground" />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to ScamGuard</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto text-balance">
          Your AI-powered shield against scams. Let's set up your account to get the most out of ScamGuard.
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
        <h1 className="text-2xl font-bold tracking-tight">What's Your Goal?</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Select all that apply. We'll personalize your experience based on your choices.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {goals.map((goal) => {
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border/50 bg-card hover:border-border hover:bg-muted/50"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                <goal.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{goal.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{goal.description}</div>
              </div>
              {isSelected && (
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={selectedGoals.length === 0}
          className="bg-gradient-to-r from-primary to-primary/80"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function RecommendationsStep({ selectedGoals, onComplete, onBack }) {
  const recommendations = [];

  if (selectedGoals.includes("protect_self") || selectedGoals.includes("learn_scams")) {
    recommendations.push({
      icon: Search,
      title: "Check Your First Message",
      description: "Head to the home page and paste any suspicious message you've received. Get an instant AI risk assessment.",
      action: "Go to Message Checker",
    });
  }
  if (selectedGoals.includes("protect_family") || selectedGoals.includes("realtime_alerts")) {
    recommendations.push({
      icon: Users,
      title: "Add a Family Member",
      description: "Set up Senior Guardian mode to monitor and receive alerts when your loved ones encounter suspicious messages.",
      action: "Set Up Family Protection",
    });
  }
  if (selectedGoals.includes("ai_assistant")) {
    recommendations.push({
      icon: Bot,
      title: "Try the AI Chat",
      description: "Chat with our AI expert anytime. Ask about a suspicious message, learn about scam tactics, or get advice.",
      action: "Open AI Chat",
    });
  }
  if (selectedGoals.includes("browser_protection")) {
    recommendations.push({
      icon: Puzzle,
      title: "Install the Chrome Extension",
      description: "Analyze messages right from your browser. Right-click any text and get an instant scam check.",
      action: "Get the Extension",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      icon: Shield,
      title: "You're All Set!",
      description: "Start by checking a suspicious message on the home page. You can always come back to explore more features.",
      action: "Go to Home",
    });
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Heart className="w-7 h-7 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Your Personalized Plan</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Based on your goals, here's what we recommend doing first.
        </p>
      </div>
      <div className="space-y-3">
        {recommendations.map((rec, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <rec.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{rec.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{rec.description}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button onClick={onComplete} className="bg-gradient-to-r from-primary to-primary/80">
          <Check className="w-4 h-4 mr-1" />
          Complete Setup
        </Button>
      </div>
    </div>
  );
}