import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What Forge Layer ships next — Studio deploy, citations, appeals, attestations.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
