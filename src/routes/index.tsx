import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles, MessageSquareCode, Database, Rocket, Eye, Shield,
  Github, Smartphone, Zap, ArrowRight, Check, Send, Paintbrush, Layers,
} from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import productShot from "@/assets/product-shot.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen text-foreground overflow-x-hidden">
      <Nav />
      <Hero />
      <LogoStrip />
      <Features />
      <HowItWorks />
      <ProductPreview />
      <Stack />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/60 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 font-display font-bold text-xl">
          <div className="w-8 h-8 rounded-lg" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }} />
          VibeBuild
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#stack" className="hover:text-foreground transition">Stack</a>
          <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <a href="#" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition">Sign in</a>
          <a href="#cta" className="btn-hero hover:btn-hero-hover text-sm">Start building</a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const [prompt, setPrompt] = useState("");
  return (
    <section className="relative pt-32 pb-24 px-6 overflow-hidden">
      <img
        src={heroBg}
        alt=""
        width={1920}
        height={1080}
        className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent, oklch(0.14 0.03 275) 90%)" }} />
      <div className="relative max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-xs font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--neon-cyan)" }} />
          Now with multi-modal vision & 1-click Postgres
        </div>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] mb-6">
          Vibe-code your <br />
          <span className="gradient-text">next full-stack app</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Describe it. Preview it. Deploy it. VibeBuild turns natural language into
          production-ready web & mobile apps — database, auth and integrations included.
        </p>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="glass-card rounded-2xl p-3 max-w-2xl mx-auto flex items-center gap-2 glow-primary"
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A CRM for my design studio with client portal…"
            className="flex-1 bg-transparent px-4 py-3 outline-none text-base placeholder:text-muted-foreground"
          />
          <button type="submit" className="btn-hero hover:btn-hero-hover inline-flex items-center gap-2">
            Generate <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs">
          {["Internal CRM", "Marketplace", "AI chatbot", "Booking app", "Landing page"].map((t) => (
            <button key={t} className="px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/10 transition text-muted-foreground">
              {t}
            </button>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
          <Stat value="< 45s" label="First live app" />
          <Stat value="98%" label="Prompt-to-live" />
          <Stat value="1-click" label="Deploy & sync" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-display font-bold gradient-text">{value}</div>
      <div className="text-xs uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

function LogoStrip() {
  return (
    <section className="border-y border-border/50 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
          Trusted by builders shipping to production
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4 opacity-60 font-display font-bold text-xl">
          {["NORTHWIND", "acme.io", "PIXELFORGE", "OrbitLab", "Vantage", "Kinetic"].map((n) => (
            <span key={n} className="text-muted-foreground hover:text-foreground transition">{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: MessageSquareCode, title: "Conversational Studio", desc: "Chat-driven development that streams real code, styling and schema updates as you type." },
    { icon: Eye, title: "Live sandbox preview", desc: "Hot-reloading dual-view. Click any element to tweak text, color and layout visually." },
    { icon: Database, title: "Instant Postgres", desc: "AI writes and migrates your schema automatically — likes, comments, orders, whatever you ask." },
    { icon: Shield, title: "1-click auth", desc: "Email, password and preset roles like Admin & Staff wired in without touching a config file." },
    { icon: Zap, title: "Multi-modal vision", desc: "Drop a screenshot or wireframe and watch VibeBuild recreate the UI pixel-for-pixel." },
    { icon: Github, title: "GitHub sync, no lock-in", desc: "Every AI edit auto-commits. Pull the code and extend it manually whenever you want." },
    { icon: Smartphone, title: "PWA & mobile ready", desc: "Ships as an installable Progressive Web App with custom icons for iOS and Android." },
    { icon: Layers, title: "Integrations by prompt", desc: "\"Add Stripe checkout.\" \"Send emails via Resend.\" It just wires up." },
  ];
  return (
    <section id="features" className="py-28 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <div className="text-sm uppercase tracking-widest gradient-text font-semibold mb-3">Everything you need</div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">A full studio behind every prompt</h2>
          <p className="text-muted-foreground text-lg">
            No boilerplate. No plumbing. Just a chat that turns into a real, deployable product.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card rounded-2xl p-6 hover:-translate-y-1 transition duration-300 group">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"
                   style={{ background: "var(--gradient-hero)" }}>
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Describe the vibe", desc: "Type or paste a screenshot. The multi-agent system parses UI, data model and logic in parallel." },
    { n: "02", title: "Watch it build", desc: "React + Tailwind + Node + Postgres scaffolds itself in under a minute, streaming into your preview." },
    { n: "03", title: "Refine visually", desc: "Click any element to tweak. Ask for changes in chat. Hot-reload lands in 5–15 seconds." },
    { n: "04", title: "Ship it", desc: "1-click deploy to your subdomain, custom domain or your own GitHub. It's your code." },
  ];
  return (
    <section id="how" className="py-28 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <div className="text-sm uppercase tracking-widest gradient-text font-semibold mb-3">How it works</div>
          <h2 className="text-4xl md:text-5xl font-bold">From thought to production in four steps</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="glass-card rounded-2xl p-7 h-full">
                <div className="font-mono text-sm gradient-text font-bold mb-4">{s.n}</div>
                <h3 className="text-xl font-semibold mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 text-primary/40 w-6 h-6" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <section className="py-28 px-6 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-sm uppercase tracking-widest gradient-text font-semibold mb-3">The workspace</div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Chat left. Live app right.</h2>
          <p className="text-muted-foreground text-lg">
            A dual-view studio built for flow. Iterate in plain English while your app hot-reloads next to you.
          </p>
        </div>
        <div className="relative rounded-3xl overflow-hidden glass-card p-2 glow-primary">
          <img
            src={productShot}
            alt="VibeBuild workspace preview"
            width={1600}
            height={1000}
            loading="lazy"
            className="w-full rounded-2xl"
          />
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-4 text-sm">
          {[
            { icon: Paintbrush, t: "Visual tweak mode", d: "Point-and-click overlays for text, color and visibility." },
            { icon: Smartphone, t: "Responsive toggle", d: "Test desktop, tablet and mobile viewports instantly." },
            { icon: Rocket, t: "1-click publish", d: "Live on a managed subdomain or your own custom domain." },
          ].map((x) => (
            <div key={x.t} className="flex gap-3 p-4 glass-card rounded-xl">
              <x.icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--neon-cyan)" }} />
              <div>
                <div className="font-semibold">{x.t}</div>
                <div className="text-muted-foreground text-xs mt-1">{x.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stack() {
  const rows = [
    ["Frontend", "React · TypeScript · Tailwind · Next.js routing"],
    ["Backend", "Node.js engine · serverless PostgreSQL"],
    ["AI orchestration", "Multi-agent (Claude 3.5 Sonnet / GPT-4o)"],
    ["Auth", "Email / password · role presets (Admin, Staff, custom)"],
    ["Deploy", "Managed subdomain · custom domain · PWA"],
    ["Security", "Sandbox isolation · auto secret & SQLi scans"],
  ];
  return (
    <section id="stack" className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-sm uppercase tracking-widest gradient-text font-semibold mb-3">Under the hood</div>
          <h2 className="text-4xl md:text-5xl font-bold">Real code. Real stack. No lock-in.</h2>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
          {rows.map(([k, v], i) => (
            <div key={k} className={`grid grid-cols-3 gap-6 px-6 py-5 font-mono text-sm ${i > 0 ? "border-t border-border/50" : ""}`}>
              <div className="text-muted-foreground uppercase tracking-widest text-xs self-center">{k}</div>
              <div className="col-span-2 text-foreground">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Free", price: "$0", tagline: "Start vibing",
      features: ["3 live apps", "Managed subdomain", "Community support", "PWA export"],
      cta: "Start free", highlight: false,
    },
    {
      name: "Pro", price: "$29", tagline: "For serious builders",
      features: ["Unlimited apps", "Custom domains", "GitHub bi-directional sync", "Higher DB limits", "Priority AI queue"],
      cta: "Go Pro", highlight: true,
    },
    {
      name: "Team", price: "$99", tagline: "Ship together",
      features: ["Everything in Pro", "Team workspaces", "Role-based access", "Audit logs", "Dedicated support"],
      cta: "Contact sales", highlight: false,
    },
  ];
  return (
    <section id="pricing" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-sm uppercase tracking-widest gradient-text font-semibold mb-3">Pricing</div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple, honest, built to scale</h2>
          <p className="text-muted-foreground text-lg">Start free. Upgrade when you're shipping to real users.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div key={p.name}
                 className={`rounded-2xl p-8 relative ${p.highlight ? "glass-card glow-primary" : "glass-card"}`}
                 style={p.highlight ? { borderColor: "var(--neon-magenta)" } : {}}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full font-semibold"
                     style={{ background: "var(--gradient-hero)", color: "white" }}>
                  MOST POPULAR
                </div>
              )}
              <div className="mb-6">
                <div className="font-display font-bold text-2xl">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.tagline}</div>
              </div>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold gradient-text">{p.price}</span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--neon-cyan)" }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button className={`w-full py-3 rounded-lg font-semibold transition ${
                p.highlight
                  ? "btn-hero hover:btn-hero-hover"
                  : "border border-border hover:bg-secondary"
              }`}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="cta" className="py-28 px-6">
      <div className="max-w-4xl mx-auto glass-card rounded-3xl p-12 md:p-16 text-center relative overflow-hidden glow-primary">
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: "var(--gradient-mesh)" }} />
        <div className="relative">
          <h2 className="text-4xl md:text-6xl font-bold mb-5">
            Your next app is <span className="gradient-text">one prompt away</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Join thousands of founders, PMs and teams shipping real products without waiting on engineering.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="#" className="btn-hero hover:btn-hero-hover inline-flex items-center gap-2">
              Start building free <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#features" className="px-6 py-3 rounded-lg border border-border hover:bg-secondary transition font-medium">
              See features
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 py-12 px-6 mt-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-display font-bold text-foreground">
          <div className="w-6 h-6 rounded-md" style={{ background: "var(--gradient-hero)" }} />
          VibeBuild
        </div>
        <div className="flex flex-wrap gap-6">
          <a href="#" className="hover:text-foreground">Docs</a>
          <a href="#" className="hover:text-foreground">Changelog</a>
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Terms</a>
        </div>
        <div>© {new Date().getFullYear()} VibeBuild. All rights reserved.</div>
      </div>
    </footer>
  );
}
