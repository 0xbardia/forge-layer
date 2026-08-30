import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  description: "Owner-gated pause, fee, and withdrawal controls for Forge Layer.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
