import React, { useState, useMemo } from "react";
import { Gamepad2, Trophy, CheckCircle2, XCircle, RotateCcw, ChevronRight, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const SCENARIOS = [
  { text: "Hey! I'm giving away free V-Bucks to the first 100 people who click this link! 🔗", isScam: true, explanation: "Real game companies never give away currency through random links. This is trying to steal your account!" },
  { text: "Your Amazon order has been shipped and will arrive Tuesday.", isScam: false, explanation: "This is a normal shipping message. Nothing suspicious here!" },
  { text: "I'm MrBeast and you won $1,000! Send me your bank info to claim it.", isScam: true, explanation: "The real MrBeast would never message you directly asking for bank details. This is an impersonator!" },
  { text: "Want to play Roblox together this weekend?", isScam: false, explanation: "This is just a friend asking to play games. Totally normal!" },
  { text: "Click here for FREE Robux! No human verification needed!", isScam: true, explanation: "There's no such thing as free Robux without verification. These sites steal your Roblox password!" },
  { text: "Your friend sent you a Discord gift! Click to claim free Nitro!", isScam: true, explanation: "Fake Discord gift links are super common. They steal your Discord login!" },
  { text: "Can you send me the homework answers for question 3?", isScam: false, explanation: "This is a normal classmate message. Nothing to worry about!" },
  { text: "I'm a Roblox admin. Your account is being deleted. Give me your password to verify it's you.", isScam: true, explanation: "Real admins NEVER ask for your password. This is a scammer pretending to be staff!" },
  { text: "Congratulations! You've been selected for a free iPhone! Just pay $5 shipping.", isScam: true, explanation: "You didn't enter any contest. 'Free' prizes that need payment are always scams!" },
  { text: "Your Minecraft realm subscription renews in 3 days.", isScam: false, explanation: "This is a normal game subscription reminder. Safe!" },
  { text: "I'm your friend from school! I got a new number. Can you send me $20 for lunch?", isScam: true, explanation: "Scammers pretend to be friends with new numbers. Always check with them in person first!" },
  { text: "You've unlocked a new badge in the game! Tap to equip it.", isScam: false, explanation: "This is a normal game notification. Safe and fun!" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function KidGames() {
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
      <div className="max-w-md mx-auto text-center space-y-6 py-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mx-auto shadow-lg shadow-violet-500/30">
          <Gamepad2 className="w-10 h-10 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-heading">Spot the Scam</h1>
          <p className="text-muted-foreground">Look at each message and tap if it's a Scam or Safe. Get the high score!</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-card rounded-xl border border-border/50 p-3">
            <p className="font-bold text-lg">10</p>
            <p className="text-xs text-muted-foreground">Questions</p>
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
        <Button onClick={start} size="lg" className="w-full gap-2 text-base bg-gradient-to-r from-violet-500 to-purple-500">
          <Gamepad2 className="w-5 h-5" /> Start Playing
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    const pct = Math.round((score / questions.length) * 100);
    const message = pct === 100 ? "Perfect! You're a scam-spotting champion! 🏆" : pct >= 70 ? "Awesome! You really know your stuff! 🌟" : pct >= 40 ? "Good try! Keep practicing! 💪" : "Keep learning — you'll get there! 📚";
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-8">
        <div className={`w-24 h-24 rounded-full ${pct >= 70 ? "bg-success/10" : "bg-warning/10"} flex items-center justify-center mx-auto`}>
          <Trophy className={`w-12 h-12 ${pct >= 70 ? "text-success" : "text-warning"}`} />
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-bold">{score} / {questions.length}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
          <Star className="w-4 h-4" /> {pct}% Correct
        </div>
        <Button onClick={start} size="lg" className="w-full gap-2 bg-gradient-to-r from-violet-500 to-purple-500">
          <RotateCcw className="w-5 h-5" /> Play Again
        </Button>
      </div>
    );
  }

  const q = questions[current];
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Question {current + 1} of {questions.length}</span>
        <div className="flex items-center gap-3">
          {streak >= 2 && <span className="text-sm font-bold text-orange-500 flex items-center gap-1">🔥 {streak}</span>}
          <span className="text-sm font-bold text-primary flex items-center gap-1">⭐ {score}</span>
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all" style={{ width: `${((current) / questions.length) * 100}%` }} />
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 sm:p-6 min-h-[140px] flex items-center">
        <p className="text-base sm:text-lg leading-relaxed">{q.text}</p>
      </div>

      {answer === null ? (
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handleAnswer(true)}
            variant="outline"
            className="h-16 text-base gap-2 rounded-2xl border-2 hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
          >
            <XCircle className="w-6 h-6" /> Scam
          </Button>
          <Button
            onClick={() => handleAnswer(false)}
            variant="outline"
            className="h-16 text-base gap-2 rounded-2xl border-2 hover:border-success/40 hover:bg-success/5 hover:text-success"
          >
            <CheckCircle2 className="w-6 h-6" /> Safe
          </Button>
        </div>
      ) : (
        <div className="space-y-4 animate-bounce-in">
          <div className={`rounded-2xl p-4 ${answer.correct ? "bg-success/10 border border-success/30" : "bg-destructive/10 border border-destructive/30"}`}>
            <div className="flex items-center gap-2 mb-2">
              {answer.correct ? <CheckCircle2 className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
              <span className={`font-bold ${answer.correct ? "text-success" : "text-destructive"}`}>
                {answer.correct ? "Correct!" : "Not quite!"}
              </span>
              <span className="text-sm text-muted-foreground ml-auto">
                This is {q.isScam ? "a scam" : "safe"}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{q.explanation}</p>
          </div>
          <Button onClick={next} className="w-full h-12 gap-2 bg-gradient-to-r from-violet-500 to-purple-500">
            {current + 1 >= questions.length ? "See Results" : "Next Question"}
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}