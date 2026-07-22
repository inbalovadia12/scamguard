import React, { useState } from "react";
import { Check, X, ChevronRight, ChevronLeft, Lightbulb, AlertCircle, BookOpen, Type, AlertTriangle, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

export default function LessonView({ lesson, onComplete, onExit }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [fillBlankInput, setFillBlankInput] = useState("");
  const [multiAnswerSelected, setMultiAnswerSelected] = useState([]);
  const [showResult, setShowResult] = useState(false);

  const totalSteps = lesson.content.length + lesson.quiz.length;
  const isQuizStep = step >= lesson.content.length;
  const quizIndex = step - lesson.content.length;
  const currentQuiz = isQuizStep ? lesson.quiz[quizIndex] : null;
  const rawQuizType = currentQuiz?.type || "multiple_choice";
  const quizType = rawQuizType === "scenario" ? "multiple_choice" : rawQuizType;

  const handleAnswer = (optionIndex) => {
    setAnswers({ ...answers, [quizIndex]: optionIndex });
  };

  const toggleMultiAnswer = (optionIndex) => {
    const newSelected = multiAnswerSelected.includes(optionIndex)
      ? multiAnswerSelected.filter((i) => i !== optionIndex)
      : [...multiAnswerSelected, optionIndex];
    setMultiAnswerSelected(newSelected);
  };

  const isAnswerSelected = () => {
    if (!currentQuiz) return false;
    if (quizType === "multiple_choice") return answers[quizIndex] != null;
    if (quizType === "true_false") return answers[quizIndex] != null;
    if (quizType === "fill_blank") return fillBlankInput.trim().length > 0;
    if (quizType === "multiple_answer") return multiAnswerSelected.length > 0;
    return false;
  };

  const checkAnswer = () => {
    if (!currentQuiz) return false;
    if (quizType === "multiple_choice") return answers[quizIndex] === currentQuiz.correct;
    if (quizType === "true_false") return answers[quizIndex] === currentQuiz.correct;
    if (quizType === "fill_blank") {
      const userAnswer = fillBlankInput.trim().toLowerCase();
      return currentQuiz.acceptable_answers.some(
        (a) => a.toLowerCase() === userAnswer
      );
    }
    if (quizType === "multiple_answer") {
      const correct = [...currentQuiz.correct].sort();
      const selected = [...multiAnswerSelected].sort();
      return correct.length === selected.length && correct.every((v, i) => v === selected[i]);
    }
    return false;
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
      setShowResult(false);
      setFillBlankInput("");
      setMultiAnswerSelected([]);
    } else {
      const correctCount = lesson.quiz.filter((q, i) => {
        const qType = q.type || "multiple_choice";
        if (qType === "multiple_choice" || qType === "scenario") return answers[i] === q.correct;
        if (q.type === "true_false") return answers[i] === q.correct;
        if (q.type === "fill_blank") {
          const saved = (answers[i + "_fill"] || "").trim().toLowerCase();
          return q.acceptable_answers.some((a) => a.toLowerCase() === saved);
        }
        if (q.type === "multiple_answer") {
          const saved = answers[i + "_multi"] || [];
          const correct = [...q.correct].sort();
          const selected = [...saved].sort();
          return correct.length === selected.length && correct.every((v, idx) => v === selected[idx]);
        }
        return false;
      }).length;
      const score = Math.round((correctCount / lesson.quiz.length) * 100);
      onComplete(score, lesson.xp);
    }
  };

  const handleCheck = () => {
    if (quizType === "fill_blank") {
      setAnswers({ ...answers, [quizIndex + "_fill"]: fillBlankInput });
    }
    if (quizType === "multiple_answer") {
      setAnswers({ ...answers, [quizIndex + "_multi"]: multiAnswerSelected });
    }
    setShowResult(true);
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
      setShowResult(false);
      setFillBlankInput("");
      setMultiAnswerSelected([]);
    }
  };

  const progress = ((step + 1) / totalSteps) * 100;
  const isCorrect = showResult ? checkAnswer() : false;

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
              <p className="text-base leading-relaxed">{lesson.content[step].body}</p>
            </div>
          ) : lesson.content[step].type === "example" ? (
            <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                <span className="text-xs font-semibold text-warning uppercase tracking-wider">
                  {lesson.content[step].title || "Example"}
                </span>
              </div>
              <p className="text-base leading-relaxed whitespace-pre-line">{lesson.content[step].body}</p>
            </div>
          ) : lesson.content[step].type === "audio_transcript" ? (
            <div className="space-y-3">
              {lesson.content[step].lines?.map((line, li) => {
                const isScammer = line.speaker === "scammer";
                return (
                  <div key={li} className={`flex gap-2.5 ${isScammer ? "" : "flex-row-reverse"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isScammer ? "bg-destructive/10" : "bg-primary/10"
                    }`}>
                      {isScammer
                        ? <AlertTriangle className="w-4 h-4 text-destructive" />
                        : <User className="w-4 h-4 text-primary" />}
                    </div>
                    <div className={`flex-1 max-w-[80%]`}>
                      <span className={`text-xs font-medium ${isScammer ? "text-destructive" : "text-primary"}`}>
                        {isScammer ? "Scammer" : "Victim"}
                      </span>
                      <div className={`rounded-2xl p-3 mt-0.5 ${
                        isScammer ? "bg-destructive/5 border border-destructive/20" : "bg-primary/5 border border-primary/20"
                      }`}>
                        <p className="text-sm leading-relaxed">{line.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {lesson.content[step].analysis && (
                <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-2xl p-4 mt-2">
                  <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">AI Analysis</span>
                    <p className="text-sm leading-relaxed mt-1">{lesson.content[step].analysis}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-base sm:text-lg leading-relaxed whitespace-pre-line">{lesson.content[step].body}</p>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border/50 p-6 sm:p-8 space-y-5 animate-fade-in" key={step}>
          {/* Quiz type badge */}
          <div className="flex items-center gap-2">
            {quizType === "fill_blank" ? <Type className="w-5 h-5 text-primary" /> : <BookOpen className="w-5 h-5 text-primary" />}
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {rawQuizType === "scenario" ? "Scenario" :
               quizType === "true_false" ? "True or False" :
               quizType === "fill_blank" ? "Fill in the Blank" :
               quizType === "multiple_answer" ? "Select All That Apply" :
               "Multiple Choice"}
               {" · "}
               Question {quizIndex + 1} of {lesson.quiz.length}
            </span>
          </div>

          {/* True/False */}
          {quizType === "true_false" ? (
            <>
              <h2 className="text-lg sm:text-xl font-semibold leading-snug">{currentQuiz.question}</h2>
              <div className="grid grid-cols-2 gap-3">
                {[{ label: "True", value: true }, { label: "False", value: false }].map((opt) => {
                  const isSelected = answers[quizIndex] === opt.value;
                  const isCorrectOpt = showResult && opt.value === currentQuiz.correct;
                  const isWrongSel = showResult && isSelected && opt.value !== currentQuiz.correct;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => !showResult && setAnswers({ ...answers, [quizIndex]: opt.value })}
                      disabled={showResult}
                      className={`p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-medium ${
                        isCorrectOpt ? "border-success bg-success/5 text-success" :
                        isWrongSel ? "border-destructive bg-destructive/5 text-destructive" :
                        isSelected ? "border-primary bg-primary/5" :
                        "border-border/50 hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      {isCorrectOpt ? <Check className="w-4 h-4" /> :
                       isWrongSel ? <X className="w-4 h-4" /> : null}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : quizType === "fill_blank" ? (
            <>
              <h2 className="text-lg sm:text-xl font-semibold leading-snug">{currentQuiz.question}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base leading-relaxed">{currentQuiz.text_before}</span>
                <Input
                  value={fillBlankInput}
                  onChange={(e) => setFillBlankInput(e.target.value)}
                  disabled={showResult}
                  placeholder="Type your answer"
                  className={`w-40 h-11 ${
                    showResult && isCorrect ? "border-success" :
                    showResult && !isCorrect ? "border-destructive" : ""
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && fillBlankInput.trim() && !showResult) handleCheck();
                  }}
                />
                <span className="text-base leading-relaxed">{currentQuiz.text_after}</span>
              </div>
              {showResult && !isCorrect && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Acceptable answers: </span>
                  {currentQuiz.acceptable_answers.join(", ")}
                </p>
              )}
            </>
          ) : quizType === "multiple_answer" ? (
            <>
              <h2 className="text-lg sm:text-xl font-semibold leading-snug">{currentQuiz.question}</h2>
              <div className="space-y-2.5">
                {currentQuiz.options.map((option, i) => {
                  const isSelected = multiAnswerSelected.includes(i);
                  const isCorrectOpt = currentQuiz.correct.includes(i);
                  const showCorrectness = showResult;
                  return (
                    <button
                      key={i}
                      onClick={() => !showResult && toggleMultiAnswer(i)}
                      disabled={showResult}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        showCorrectness && isCorrectOpt
                          ? "border-success bg-success/5"
                          : showCorrectness && isSelected && !isCorrectOpt
                          ? "border-destructive bg-destructive/5"
                          : isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        showCorrectness && isCorrectOpt
                          ? "border-success bg-success text-success-foreground"
                          : showCorrectness && isSelected && !isCorrectOpt
                          ? "border-destructive bg-destructive text-destructive-foreground"
                          : isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      }`}>
                        {showCorrectness && isCorrectOpt ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : showCorrectness && isSelected && !isCorrectOpt ? (
                          <X className="w-3.5 h-3.5" />
                        ) : isSelected ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : null}
                      </div>
                      <span className="text-sm font-medium">{option}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Multiple Choice (default) */}
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
            </>
          )}

          {/* Result feedback */}
          {showResult && (
            <div className={`rounded-xl p-4 animate-fade-in ${
              isCorrect ? "bg-success/5 border border-success/20" : "bg-destructive/5 border border-destructive/20"
            }`}>
              <p className="text-sm font-semibold mb-1">
                {isCorrect ? "✓ Correct!" : "✗ Not quite right"}
              </p>
              {currentQuiz.explanation && (
                <p className="text-sm leading-relaxed text-muted-foreground">{currentQuiz.explanation}</p>
              )}
            </div>
          )}
          {!showResult && isAnswerSelected() && (
            <Button onClick={handleCheck} className="w-full bg-gradient-to-r from-primary to-primary/80">
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