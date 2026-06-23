import { apps, operations, type Project, type ProjectBadge } from "@/lib/site/projects";

const badgeToneClass: Record<NonNullable<ProjectBadge["tone"]>, string> = {
  default: "bg-surface-3 border-line text-ink-mid",
  os: "bg-[var(--brand-2-soft)] border-[rgba(6,214,160,0.3)] text-brand-teal",
  flag: "bg-[var(--brand-3-soft)] border-[rgba(247,37,133,0.3)] text-brand-magenta",
  ops: "bg-[var(--brand-soft)] border-[rgba(99,102,241,0.3)] text-brand",
};

function ProjectCard({ project }: { project: Project }) {
  const external = project.href.startsWith("http");

  return (
    <a
      href={project.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`group relative flex min-h-[240px] flex-col gap-4 overflow-hidden rounded-box-lg border p-6 pt-7 transition duration-200 hover:-translate-y-0.5 hover:border-brand ${
        project.featured
          ? "border-[var(--brand-soft)] bg-[linear-gradient(135deg,rgba(99,102,241,0.08)_0%,var(--surface)_60%)] sm:col-span-2"
          : "border-line bg-surface hover:bg-surface-2"
      }`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl font-mono text-[16px] font-bold ${
          project.featured
            ? "bg-grad-signature text-white"
            : "border border-line-strong bg-surface-2 text-ink-high"
        }`}
      >
        {project.initials}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-low">
          {project.role}
        </div>
        <div className="text-[22px] font-bold tracking-[-0.02em]">
          {project.name}
        </div>
        <p className="text-[14px] leading-[1.55] text-ink-mid">
          {project.description}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {project.badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${
                badgeToneClass[badge.tone ?? "default"]
              }`}
            >
              {badge.label}
            </span>
          ))}
        </div>
        <span className="font-mono text-[14px] text-ink-low transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand">
          ↗
        </span>
      </div>
    </a>
  );
}

function Group({
  label,
  tone,
  projects,
}: {
  label: string;
  tone: "ops" | "apps";
  projects: Project[];
}) {
  const color = tone === "apps" ? "text-brand" : "text-brand-teal";
  const line = tone === "apps" ? "bg-brand" : "bg-brand-teal";
  return (
    <div className="mt-12">
      <div
        className={`mb-6 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.14em] ${color}`}
      >
        <span className={`h-px w-8 ${line}`} />
        {label}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.name} project={project} />
        ))}
      </div>
    </div>
  );
}

export function ContributionGrid() {
  return (
    <section id="contribution" className="scroll-mt-16 px-6 py-20 md:px-16">
      <header className="mb-14 flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <h2 className="text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.035em]">
          Things you can
          <br />
          <em className="font-serif font-normal italic text-ink-mid">
            use today.
          </em>
        </h2>
        <p className="max-w-[50ch] text-[16px] text-ink-mid">
          Open-source apps, bots, and utilities the Cardano community uses every
          day — free to try, most of them open source. Below them, the
          infrastructure I operate for other projects across the ecosystem.
        </p>
      </header>

      <Group label="Apps & Tools" tone="apps" projects={apps} />
      <Group label="Operations & Infrastructure" tone="ops" projects={operations} />
    </section>
  );
}
