import React from "react";
import { ExternalLink, ArrowRight } from "lucide-react";

const PROJECTS = [
  {
    name: "Nudigo",
    tagline: "Build better money habits and stop impulse purchases",
    description: "A personalized finance app that helps you build good financial habits, track spending, and resist impulse buying with smart nudges and insights.",
    url: "https://nudigofinance.base44.app",
    color: "from-green-500 to-teal-500",
    logo: "N",
  },
  {
    name: "Habitude",
    tagline: "Build habits, break addictions",
    description: "A habit building and addiction destroying app that helps you create lasting positive changes and overcome negative patterns with structured tracking and motivation.",
    url: "https://habitude.base44.app",
    color: "from-indigo-500 to-purple-500",
    logo: "H",
  },
];

export default function Projects() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-3 animate-slide-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">More Projects</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Explore other apps built to help you live better.
        </p>
      </div>

      <div className="grid gap-4">
        {PROJECTS.map((project, i) => (
          <a
            key={project.name}
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-card rounded-2xl border border-border/50 p-5 sm:p-6 hover:border-primary/30 hover:shadow-md transition-all animate-slide-up"
            style={{ animationDelay: `${(i + 1) * 80}ms` }}
          >
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${project.color} flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0`}>
                {project.logo}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-base sm:text-lg">{project.name}</h2>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xs sm:text-sm text-primary font-medium mt-0.5">{project.tagline}</p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{project.description}</p>
                <div className="flex items-center gap-1 mt-3 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                  Visit {project.name}
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}