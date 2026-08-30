import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Protocol",
  description: "How Forge Layer decides authenticity disputes on GenLayer.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
