import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import VardinCinematicExperience from "@/components/VardinCinematicExperience";

export default function Landing() {
  const navigate = useNavigate();
  const [showFilm, setShowFilm] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;
    base44.auth.isAuthenticated()
      .then((authed) => {
        if (!active) return;
        if (authed) {
          navigate("/dashboard", { replace: true });
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        if (active) setCheckingAuth(false);
      });
    return () => { active = false; };
  }, [navigate]);

  if (checkingAuth) {
    return <div className="min-h-[100dvh] bg-[#070809]" aria-hidden="true" />;
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#070809] font-body text-white">
      <div className="pointer-events-none absolute -left-32 top-[4%] h-[36rem] w-[36rem] rounded-full bg-[#9c2531]/[0.06] blur-[145px]" />
      <div className="pointer-events-none absolute -right-40 bottom-[-18%] h-[42rem] w-[42rem] rounded-full bg-[#247b86]/[0.05] blur-[160px]" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-6 py-6 sm:px-10 sm:py-9">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-[11px] font-medium tracking-[0.22em] text-white/78">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.04]"><ShieldCheck className="h-3.5 w-3.5" /></span>
            VARDIN
          </Link>
          <Link to="/login" className="text-[10px] tracking-[0.18em] text-white/48 transition hover:text-white">LOG IN</Link>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center pb-12 text-center">
          <p className="text-[10px] font-medium tracking-[0.32em] text-white/42">VARDIN · SCAMGUARD</p>
          <h1 className="mt-6 max-w-4xl text-balance font-heading text-[clamp(3.25rem,9vw,8rem)] font-medium leading-[0.91] tracking-[-0.06em] text-white">
            Know what you’re<br className="hidden sm:block" /> dealing with.
          </h1>
          <p className="mt-7 max-w-md text-balance text-sm leading-6 text-white/48 sm:text-base">
            Vardin adds context to suspicious calls, messages, links, and screenshots before you act.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-sm border border-[#e45761]/60 bg-[#e45761]/10 px-4 py-3 text-[10px] font-medium tracking-[0.17em] text-white transition hover:bg-[#e45761]/20">
              GET STARTED <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button onClick={() => setShowFilm(true)} className="rounded-sm border border-white/[0.16] px-4 py-3 text-[10px] font-medium tracking-[0.17em] text-white/70 transition hover:border-white/35 hover:text-white">
              SEE WHAT VARDIN DOES
            </button>
          </div>
        </section>

        <div className="text-center text-[9px] tracking-[0.22em] text-white/26">CONTEXT BEFORE ACTION</div>
      </div>

      {showFilm && (
        <VardinCinematicExperience
          mode="public"
          onExit={() => setShowFilm(false)}
          onComplete={() => navigate("/register")}
        />
      )}
    </main>
  );
}
