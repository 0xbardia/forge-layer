import { DisputeDetail } from "./detail";

export function generateStaticParams() {
  // Single shell. Direct /disputes/:id hits are rewritten to this page
  // (Python static server and vercel.json). The client reads the id from the path.
  return [{ id: "_" }];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DisputeDetail routeId={id} />;
}
