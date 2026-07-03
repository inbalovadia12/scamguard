import { Link } from "react-router-dom";
import { ShieldCheck, Twitter, Github, Linkedin } from "lucide-react";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "How It Works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Chrome Extension", href: "/extension" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "#" },
      { label: "FAQ", href: "#faq" },
      { label: "Security", href: "#" },
      { label: "Scam Database", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/landing" },
      { label: "Contact", href: "mailto:support@vardin.app" },
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-border/50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold tracking-tight font-heading">Vardin</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              AI-powered scam detection and family protection. Know what's real before you click.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Github className="w-4 h-4" /></a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Linkedin className="w-4 h-4" /></a>
            </div>
          </div>
          {footerSections.map((section, i) => (
            <div key={i}>
              <h4 className="font-semibold text-sm mb-3 font-heading">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link, j) => (
                  <li key={j}>
                    {link.href.startsWith("#") || link.href.startsWith("mailto:") ? (
                      <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</a>
                    ) : (
                      <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© 2026 Vardin. All rights reserved.</p>
          <p>Stay safe out there.</p>
        </div>
      </div>
    </footer>
  );
}