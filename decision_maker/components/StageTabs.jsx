"use client";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export default function StageTabs({ id }) {
  const seg = useSelectedLayoutSegment(); // "pre" | "post"
  const tabs = [
    { slug: "pre",  label: "Pre Decision Tools" },
    { slug: "post", label: "Post Decision Tools" },
  ];

  return (
    <nav className="sticky top-0 z-10 bg-white">
      <div className="border-4 border-black">
        <div className="grid grid-cols-2 divide-x-4 divide-black">
          {tabs.map(t => {
            const active = seg === t.slug;
            return (
              <Link
                key={t.slug}
                href={`/decision/${id}/${t.slug}`}
                aria-current={active ? "page" : undefined}
                className={[
                  "block text-center py-2 font-medium select-none",
                  active ? "bg-red-500 text-black" : "bg-white hover:bg-gray-50",
                ].join(" ")}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
