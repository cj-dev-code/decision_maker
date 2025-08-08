// app/decision/[id]/page.tsx
import { redirect } from "next/navigation";
export default function Page({ params }) {
  redirect(`/decision/${params.id}/pre`);
}