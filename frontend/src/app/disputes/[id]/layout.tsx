import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docket",
  description: "Cited work, stakes, verdict, and reasoning for a Forge Layer dispute.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
