import Sidebar from "@/components/Sidebar";
import Notes from "@/components/Notes";
import StageTabs from "@/components/StageTabs";

export default async function DecisionLayout({ children, params }) {
  const { id } = await params;
  return (
    <>
      <Sidebar />
      <section className="p-4 overflow-hidden flex flex-col">
        <div className="mb-2 text-sm text-gray-500">Current Goal → {id}</div>
        <StageTabs id={id} />
        <div className="flex-1 min-h-0">{children}</div>
      </section>
      <Notes />
    </>
  );
}
