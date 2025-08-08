// app/page.jsx  (or page.tsx if you're using TypeScript)
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/decision/demo/pre'); // pick your default decision id
}
