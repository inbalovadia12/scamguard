import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import ScenarioSelector from "@/components/call-simulator/ScenarioSelector";
import CallInterface from "@/components/call-simulator/CallInterface";
import CallScoreCard from "@/components/call-simulator/CallScoreCard";
import { getCreditStatus } from "@/lib/credits";
import LockedFeature from "@/components/LockedFeature";

export default function CallSimulator() {
  const [credits, setCredits] = useState(null);
  const [phase, setPhase] = useState("select"); // select | calling | scoring
  const [scenario, setScenario] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [score, setScore] = useState(null);
  const [starting, setStarting] = useState(false);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    getCreditStatus().then(setCredits);
  }, []);

  const handleSelectScenario = useCallback(async (selected) => {
    setScenario(selected);
    setStarting(true);
    setConversation([]);
    setScore(null);

    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("simulateScamCall", {
        action: "start",
        scenario_id: selected.id,
        language: lang,
      });
      const data = response.data;
      if (data.error) throw new Error(data.error);

      setConversation([{
        speaker: "scammer",
        text: data.scammer_line,
        tactic: data.tactic_used,
      }]);
      setPhase("calling");
    } catch (e) {
      setConversation([{
        speaker: "scammer",
        text: "Hello, is this the right number?",
        tactic: "Initial Contact",
      }]);
      setPhase("calling");
    } finally {
      setStarting(false);
    }
  }, []);

  const handleEndCall = useCallback(async (finalConvo) => {
    setPhase("scoring");
    setScoring(true);

    try {
      const lang = localStorage.getItem("vardin_language") || "en";
      const response = await base44.functions.invoke("simulateScamCall", {
        action: "end",
        scenario_id: scenario.id,
        conversation: finalConvo,
        language: lang,
      });
      const data = response.data;
      if (data.error) throw new Error(data.error);

      setScore(data);

      // Save progress as a lesson completion
      try {
        const existing = await base44.entities.LessonProgress.filter({
          lesson_id: `call_simulator_${scenario.id}`,
        });
        if (existing.length > 0) {
          const best = existing[0];
          if (data.overall_score > (best.score || 0)) {
            await base44.entities.LessonProgress.update(best.id, {
              status: "completed",
              score: data.overall_score,
              xp_earned: Math.max(50, Math.round(data.overall_score / 2)),
              completed_date: new Date().toISOString(),
            });
          }
        } else {
          await base44.entities.LessonProgress.create({
            lesson_id: `call_simulator_${scenario.id}`,
            category: "call_practice",
            status: "completed",
            score: data.overall_score,
            xp_earned: Math.max(50, Math.round(data.overall_score / 2)),
            started_date: new Date().toISOString(),
            completed_date: new Date().toISOString(),
          });
        }
      } catch {}
    } catch (e) {
      setScore({
        overall_score: 0,
        grade: "F",
        breakdown: [],
        strengths: [],
        improvements: [],
        summary: `Could not generate score: ${e.message}. Try ending the call again.`,
        tactics_encountered: [],
      });
    } finally {
      setScoring(false);
    }
  }, [scenario]);

  const handleRetry = () => {
    setScore(null);
    setConversation([]);
    handleSelectScenario(scenario);
  };

  const handleBackToScenarios = () => {
    setPhase("select");
    setScenario(null);
    setConversation([]);
    setScore(null);
  };

  if (!credits) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!credits.isPremiumPlan && !credits.isPlusPlan) {
    return (
      <LockedFeature
        title="Premium Call Simulator"
        description="Roleplay against AI scammers in realistic phone call scenarios and get scored on your scam detection skills."
        buttonLabel="Upgrade to Premium"
        icon={Phone}
      />
    );
  }

  // Starting phase
  if (starting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in">
        <div className="relative">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${scenario?.avatar_color || "from-primary to-primary/70"} flex items-center justify-center text-3xl`}>
            {scenario?.avatar_emoji || "📞"}
          </div>
          <div className="absolute -inset-2 rounded-2xl border-2 border-primary/20 animate-ping" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold">Connecting call...</p>
          <p className="text-xs text-muted-foreground">{scenario?.caller_name} is dialing in</p>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Scoring phase
  if (phase === "scoring" && scoring) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold">Analyzing your call...</p>
          <p className="text-xs text-muted-foreground">Evaluating how you handled each tactic</p>
        </div>
      </div>
    );
  }

  // Score phase
  if (phase === "scoring" && score) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={handleBackToScenarios} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Button>
        </div>
        <CallScoreCard
          scenario={scenario}
          score={score}
          onRetry={handleRetry}
          onBackToScenarios={handleBackToScenarios}
        />
      </div>
    );
  }

  // Calling phase
  if (phase === "calling" && scenario) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBackToScenarios} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Button>
          <span className="text-xs text-muted-foreground">{scenario.title}</span>
        </div>
        <CallInterface
          scenario={scenario}
          conversation={conversation}
          setConversation={setConversation}
          onEndCall={handleEndCall}
        />
      </div>
    );
  }

  // Selection phase
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <Link to="/lessons">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Lessons
          </Button>
        </Link>
      </div>
      <ScenarioSelector onSelect={handleSelectScenario} />
    </div>
  );
}