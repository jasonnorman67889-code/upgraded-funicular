import type { WorkbookConfig } from "../lib/workbook";

type Props = {
  workbook: WorkbookConfig;
};

export function WorkbookRenderer({ workbook }: Props) {
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-panel/60 p-4 backdrop-blur">
      <h2 className="mb-3 text-lg font-semibold">Workbook: {workbook.name}</h2>
      <div className="space-y-4">
        {workbook.sections.map((section) => (
          <div key={section.id} className="rounded-lg border border-white/5 bg-slate-900/40 p-3">
            <h3 className="mb-2 font-medium">{section.title}</h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {section.widgets.map((widget) => (
                <div key={widget.id} className="rounded border border-white/10 p-2 text-sm">
                  <div className="font-semibold">{widget.title}</div>
                  <div className="text-xs text-slate-400">{widget.type}</div>
                  <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs text-slate-300">{widget.query}</pre>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
