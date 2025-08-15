// components/AxesPicker.jsx
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_AXES, colorForAxis } from "./axes/Axes";

export default function AxesPicker() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  const selected = sp.get("axis") || "";

  const onChange = (e) => {
    const axis = e.target.value;
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (axis) params.set("axis", axis); else params.delete("axis");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const color = colorForAxis(selected);

  return (
    <div className="w-full h-full border p-3 rounded snap-start shrink-0">
      <label className="block text-xs mb-1">Axes</label>
      <select
        className="w-full border rounded px-2 py-1 text-sm"
        value={selected}
        onChange={onChange}
        style={selected ? { borderColor: color, outlineColor: color } : {}}
      >
        <option value="">— Pick an axis —</option>
        {DEFAULT_AXES.map(a => (
          <option key={a.id} value={a.id}>{a.label}</option>
        ))}
      </select>
    </div>
  );
}
