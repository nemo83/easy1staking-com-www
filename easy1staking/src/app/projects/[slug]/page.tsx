import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OverviewPage } from "@/components/site/OverviewPage";
import { editorialProjects } from "@/lib/site/editorial";

export const dynamicParams = false;

export function generateStaticParams() {
  return editorialProjects.map(({ slug }) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

async function findProject(params: Props["params"]) {
  const { slug } = await params;
  const project = editorialProjects.find((entry) => entry.slug === slug);
  if (!project) notFound();
  return project;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await findProject(params);
  const url = `/projects/${project.slug}`;
  return {
    title: project.name, description: project.summary, alternates: { canonical: url },
    openGraph: { title: `${project.name} | EASY1`, description: project.summary, url, type: "website", images: [{ url: project.capture, alt: project.captureAlt }] },
  };
}

export default async function ProjectPage({ params }: Props) {
  return <OverviewPage project={await findProject(params)} />;
}
