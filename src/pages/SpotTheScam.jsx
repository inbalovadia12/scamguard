import React, { useState } from "react";
import { Scan, Trophy, CheckCircle2, XCircle, RotateCcw, ChevronRight, Star, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const SCENARIOS = [
  { text: "URGENT: Your bank account has been limited. Verify your identity within 24 hours or your account will be closed: bank-secure-verify.xyz", isScam: true, explanation: "Banks never send urgent threats with suspicious links. The domain is fake. Always log in by typing your bank's URL directly." },
  { text: "Your FedEx package is delayed. Track it here: fedex-tracking-portal.com/track?id=8847", isScam: true, explanation: "The domain isn't fedex.com — it's a lookalike. Delivery scam links steal your info or install malware." },
  { text: "Hey, it's Sarah! I'm traveling and my wallet was stolen. Can you wire $2,000 urgently? This is my new number.", isScam: true, explanation: "Classic 'stranded friend' scam. Scammers hack accounts or spoof numbers. Always verify through another channel before sending money." },
  { text: "Invest $500 in our crypto fund and earn guaranteed 10% monthly returns. Limited spots available!", isScam: true, explanation: "No legitimate investment offers guaranteed returns. 'Guaranteed' + high returns + urgency = scam. Crypto scams are the top financial fraud today." },
  { text: "Your Netflix subscription renewed successfully. $15.99 charged to your card ending in 4242.", isScam: false, explanation: "Normal subscription notification with specific details. No suspicious links or requests for action." },
  { text: "Microsoft Windows Security Alert: Your computer is infected with 5 viruses! Call 1-800-555-0199 immediately for support.", isScam: true, explanation: "Tech support scam. Microsoft never shows pop-up virus alerts with phone numbers. These scammers take over your computer and steal money." },
  { text: "I'm your manager. I need you to buy 5 Apple gift cards ($200 each) for client gifts. I'll reimburse you Monday. Keep this between us.", isScam: true, explanation: "Gift card scam impersonating your boss. Real companies never ask for gift card purchases secretly. Verify through official company channels." },
  { text: "Your Amazon order #112-8347592-3341 has shipped and will arrive Friday.", isScam: false, explanation: "Legitimate shipping notice with a real order number format. No suspicious links or requests." },
  { text: "You've been pre-approved for a $50,000 personal loan with no credit check! Apply now — funds in 24 hours.", isScam: true, explanation: "No legitimate lender offers loans with no credit check. Upfront approval + no credit check = advance fee loan scam." },
  { text: "Thank you for your donation to the Red Cross. Your tax receipt is attached to your account portal.", isScam: false, explanation: "Normal donation receipt. No urgent requests or suspicious links — just a confirmation." },
  { text: "Hi! I'm a recruiter from Google. I found your LinkedIn profile and think you'd be great for a role. Are you open to a chat?", isScam: false, explanation: "Legitimate recruiters do reach out on LinkedIn. Verify through LinkedIn messages rather than external email or apps." },
  { text: "Your iCloud storage is full. Your photos will be deleted in 48 hours. Sign in now to upgrade: apple-id-verify.com", isScam: true, explanation: "Apple never threatens to delete photos and the domain isn't apple.com. Phishing link to steal your Apple ID password." },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SpotTheScam() {
  const [phase, setPhase] = useState("intro");
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const start = () => {
    setQuestions(shuffle(SCENARIOS).slice(0, 10));
    setCurrent(0);
    setScore(0);
    setStreak(0);
    setAnswer(null);
    setPhase("playing");
  };

  const handleAnswer = (isScam) => {
    if (answer !== null) return;
    const correct = isScam === questions[current].isScam;
    setAnswer({ chosen: isScam, correct });
    if (correct) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  };

  const next = () => {
    if (current + 1 >= questions.length) {
      setPhase("done");
    } else {
      setCurrent((c) => c + 1);
      setAnswer(null);
    }
  };

  if (phase === "intro") {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
          <Scan className="w-8 h-8 text-primary-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-heading">Spot the Scam</h1>
          <p className="text-muted-foreground">Test your scam detection skills. Read each message and decide — is it a scam or safe?</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-card rounded-xl border border-border/50 p-3">
            <p className="font-bold text-lg">10</p>
            <p className="text-xs text-muted-foreground">Rounds</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-3">
            <p className="font-bold text-lg">⭐</p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-3">
            <p className="font-bold text-lg">🔥</p>
            <p className="text-xs text-muted-foreground">Streaks</p>
          </div>
        </div>
        <Button onClick={start} size="lg" className="w-full gap-2 text-base bg-gradient-to-r from-primary to-primary/80">
          <Scan className="w-5 h-5" /> Start Game
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    const pct = Math.round((score / questions.length) * 100);
    const message = pct === 100 ? "Perfect! You're a scam detection expert." : pct >= 70 ? "Great work — you really know your stuff." : pct >= 40 ? "Decent. Review the explanations to sharpen your skills." : "Keep practicing — scams evolve fast!";
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-8">
        <div className={`w-20 h-20 rounded-full ${pct >= 70 ? "bg-success/10" : "bg-warning/10"} flex items-center justify-center mx-auto`}>
          <Trophy className={`w-10 h-10 ${pct >= 70 ? "text-success" : "text-warning"}`} />
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-heading">{score} / {questions.length}</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">{message}</p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
          <Star className="w-4 h-4" /> {pct}% Correct
        </div>
        <Button onClick={start} size="lg" className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80">
          <RotateCcw className="w-5 h-5" /> Play Again
        </Button>
      </div>
    );
  }

  const q = questions[current];
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Round {current + 1} of {questions.length}</span>
        <div className="flex items-center gap-3">
          {streak >= 2 && <span className="text-sm font-bold text-orange-500 flex items-center gap-1">🔥 {streak}</span>}
          <span className="text-sm font-bold text-primary flex items-center gap-1">⭐ {score}</span>
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${(current / questions.length) * 100}%` }} />
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 min-h-[140px] flex items-center">
        <div className="flex gap-3 w-full">
          <ShieldAlert className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm sm:text-base leading-relaxed">{q.text}</p>
        </div>
      </div>

      {answer === null ? (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handleAnswer(true)}
            variant="outline"
            className="h-14 text-sm gap-2 rounded-2xl border-2 hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
          >
            <XCircle className="w-5 h-5" /> It's a Scam
          </Button>
          <Button
            onClick={() => handleAnswer(false)}
            variant="outline"
            className="h-14 text-sm gap-2 rounded-2xl border-2 hover:border-success/40 hover:bg-success/5 hover:text-success"
          >
            <CheckCircle2 className="w-5 h-5" /> It's Safe
          </Button>
        </div>
      ) : (
        <div className="space-y-4 animate-bounce-in">
          <div className={`rounded-2xl p-4 ${answer.correct ? "bg-success/10 border border-success/30" : "bg-destructive/10 border border-destructive/30"}`}>
            <div className="flex items-center gap-2 mb-2">
              {answer.correct ? <CheckCircle2 className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
              <span className={`font-bold ${answer.correct ? "text-success" : "text-destructive"}`}>
                {answer.correct ? "Correct!" : "Not quite."}
              </span>
              <span className="text-sm text-muted-foreground ml-auto">
                Answer: {q.isScam ? "Scam" : "Safe"}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{q.explanation}</p>
          </div>
          <Button onClick={next} className="w-full h-12 gap-2 bg-gradient-to-r from-primary to-primary/80">
            {current + 1 >= questions.length ? "See Results" : "Next Round"}
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}