import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registry",
  description: "Browse the Forge Layer public authenticity docket.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
