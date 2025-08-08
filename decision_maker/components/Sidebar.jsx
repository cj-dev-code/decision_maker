// components/Sidebar.tsx
import Link from "next/link";
export default function Sidebar() {
  return (
    <aside className="border-r p-3 text-sm space-y-2">
      <div className="font-medium">User Info</div>
      <ul className="space-y-1">
        {["Goal 1","Goal 2","Goal 3"].map((g,i)=>(
          <li key={i}><Link className="hover:underline" href={`/decision/${i}/pre`}>{g}</Link></li>
        ))}
      </ul>
    </aside>
  );
}