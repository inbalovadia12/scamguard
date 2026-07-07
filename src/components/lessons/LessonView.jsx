import React, { useState } from "react";
import { Check, X, ChevronRight, ChevronLeft, Lightbulb, AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function LessonView({ lesson, onComplete, onExit }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);

  const totalSteps = lesson.content.length + lesson.quiz.length;
  const isQuizStep = step >= lesson.content.length;
  const quizIndex = step - lesson.content.length;
  const currentQuiz = isQuizStep ? lesson.quiz[quizIndex] : null;

  const handleAnswer = (optionIndex) => {
    setAnswers({ ...answers, [quizIndex]: optionIndex });
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
      setShowResult(false);
    } else {
      const correctCount = lesson.quiz.filter(
        (q, i) => answers[i] === q.correct
      ).length;
      const score = Math.round((correctCount / lesson.quiz.length) * 100);
      onComplete(score, lesson.xp);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
      setShowResult(false);
    }
  };

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-1">
          <ChevronLeft className="w-4 h-4" />
          Exit
        </Button>
        <div className="flex-1 max-w-xs">
          <Progress value={progress} className="h-2" />
        </div>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">
          {step + 1}/{totalSteps}
        </span>
      </div>

      {/* Content */}
      {!isQuizStep ? (
        <div className="bg-card rounded-3xl border border-border/50 p-6 sm:p-8 space-y-5 animate-fade-in" key={step}>
          {lesson.content[step].heading && (
            <h2 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">
              {lesson.content[step].heading}
            </h2>
          )}
          {lesson.content[step].type === "tip" ? (
            <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl p-4">
              <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{lesson.content[step].body}</p>
            </div>
          ) : lesson.content[step].type === "example" ? (
            <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                <span className="text-xs font-semibold text-warning uppercase tracking-wider">
                  {lesson.content[step].title || "Example"}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{lesson.content[step].body}</p>
            </div>
          ) : (
            <p className="text-base leading-relaxed whitespace-pre-line">{lesson.content[step].body}</p>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border/50 p-6 sm:p-8 space-y-5 animate-fade-in" key={step}>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Quiz Question {quizIndex + 1} of {lesson.quiz.length}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold leading-snug">{currentQuiz.question}</h2>
          <div className="space-y-2.5">
            {currentQuiz.options.map((option, i) => {
              const isSelected = answers[quizIndex] === i;
              const isCorrect = i === currentQuiz.correct;
              const showCorrectness = showResult;

              return (
                <button
                  key={i}
                  onClick={() => !showResult && handleAnswer(i)}
                  disabled={showResult}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    showCorrectness && isCorrect
                      ? "border-success bg-success/5"
                      : showCorrectness && isSelected && !isCorrect
                      ? "border-destructive bg-destructive/5"
                      : isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/30 hover:bg-muted/50"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    showCorrectness && isCorrect
                      ? "border-success bg-success text-success-foreground"
                      : showCorrectness && isSelected && !isCorrect
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  }`}>
                    {showCorrectness && isCorrect ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : showCorrectness && isSelected && !isCorrect ? (
                      <X className="w-3.5 h-3.5" />
                    ) : null}
                  </div>
                  <span className="text-sm font-medium">{option}</span>
                </button>
              );
            })}
          </div>
          {showResult && currentQuiz.explanation && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 animate-fade-in">
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Explanation: </span>
                {currentQuiz.explanation}
              </p>
            </div>
          )}
          {!showResult && answers[quizIndex] != null && (
            <Button onClick={() => setShowResult(true)} className="w-full bg-gradient-to-r from-primary to-primary/80">
              Check Answer
            </Button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handlePrev} disabled={step === 0} className="gap-1">
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        {(!isQuizStep || showResult) && (
          <Button onClick={handleNext} className="gap-1 bg-gradient-to-r from-primary to-primary/80">
            {step === totalSteps - 1 ? "Complete Lesson" : "Continue"}
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}