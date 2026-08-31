import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security",
  description: "Forge Layer threat model, host policy, and Studio deploy notes.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
