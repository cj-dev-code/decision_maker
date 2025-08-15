// components/axes/axes.js
export const DEFAULT_AXES = [
  { id: "company_stage", label: "Company stage", color: "#ef4444" },  // red-500
  { id: "problem_domain", label: "Problem domain", color: "#f59e0b" },// amber-500
  { id: "work_model", label: "Work model", color: "#10b981" },       // emerald-500
  { id: "team_type", label: "Team type", color: "#3b82f6" },         // blue-500
  { id: "model_family", label: "Model family", color: "#a855f7" },   // violet-500
];

export const colorForAxis = (axisId) =>
  (DEFAULT_AXES.find(a => a.id === axisId)?.color) || "#6b7280"; // gray-500
