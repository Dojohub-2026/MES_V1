import { useState } from 'react';
import { ArrowLeft, ChevronDown, AlertTriangle, Check, Loader2, Package } from 'lucide-react';
import type { FaultCategory } from '../types';
import { OTHER_FAULT_CATEGORY } from '../types';

interface IssueLoggerProps {
  faultCategories: FaultCategory[];
  stageName: string;
  jobId: string;
  jobName: string;
  productName: string | null;
  onSubmit: (payload: { faultName: string; severity: 'CRITICAL' | 'MINOR'; notes: string }) => Promise<void>;
  onBack: () => void;
}

export function IssueLogger({ faultCategories, stageName, jobId, jobName, productName, onSubmit, onBack }: IssueLoggerProps) {

  const options = [...faultCategories, OTHER_FAULT_CATEGORY];
  const [selectedId, setSelectedId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selected = options.find((f) => f.id === selectedId) || null;
  const isCritical = selected?.severity === 'CRITICAL';

  const handleSubmit = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        faultName: selected.faultName,
        severity: selected.severity,
        notes: notes.trim() || '(No additional notes)',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-base font-semibold text-navy-700 active:opacity-70 transition-opacity"
        >
          <ArrowLeft size={22} strokeWidth={2.5} />
          Return to Active Process
        </button>
      </header>

      <div className="px-4 py-3 bg-navy-50 border-b border-navy-100">
        <div className="flex items-center gap-2 text-sm text-navy-700">
          <Package size={16} strokeWidth={2.5} />
          <span className="font-semibold">{jobName}</span>
          <span className="text-navy-400">·</span>
          <span className="text-navy-500">{jobId}</span>
          <span className="text-navy-400">·</span>
          <span>{stageName}</span>
          {productName && (
            <>
              <span className="text-navy-400">·</span>
              <span className="truncate">{productName}</span>
            </>
          )}
        </div>
      </div>

      <main className="flex-1 px-4 py-5 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Report Issue</h1>
          <p className="text-base text-slate-500">
            Log a production problem. The process keeps running while you report.
          </p>
        </div>

        <div>
          <label className="block text-base font-bold text-slate-800 mb-2">Fault Category</label>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 text-left transition-all ${
                isDropdownOpen ? 'border-navy-500 ring-4 ring-navy-500/10' : 'border-slate-200'
              } bg-white`}
            >
              <span className={`text-base ${selected ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                {selected ? selected.faultName : 'Select a fault category...'}
              </span>
              <ChevronDown
                size={24}
                className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border-2 border-slate-200 shadow-card-elevated z-20 max-h-64 overflow-y-auto">
                {options.map((fault) => (
                  <button
                    key={fault.id}
                    onClick={() => {
                      setSelectedId(fault.id);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        fault.severity === 'CRITICAL' ? 'bg-danger-100' : 'bg-warning-100'
                      }`}
                    >
                      <AlertTriangle
                        size={18}
                        className={fault.severity === 'CRITICAL' ? 'text-danger-600' : 'text-warning-600'}
                        strokeWidth={2.5}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-slate-900">{fault.faultName}</p>
                      <p className="text-sm text-slate-500">
                        {fault.severity === 'CRITICAL' ? 'Critical severity' : 'Minor severity'}
                      </p>
                    </div>
                    {selectedId === fault.id && <Check size={20} className="text-navy-600" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div className={`rounded-2xl p-5 border-2 ${isCritical ? 'bg-danger-50 border-danger-300' : 'bg-warning-50 border-warning-300'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isCritical ? 'bg-danger-500' : 'bg-warning-500'}`}>
                <AlertTriangle size={26} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">Severity Tier</p>
                <p className={`text-xl font-bold tracking-wide ${isCritical ? 'text-danger-700' : 'text-warning-700'}`}>
                  {isCritical ? 'CRITICAL' : 'MINOR'}
                </p>
              </div>
            </div>
            <p className={`text-sm mt-3 ${isCritical ? 'text-danger-600' : 'text-warning-600'}`}>
              {isCritical
                ? 'This issue requires immediate manager attention. Production may need to halt.'
                : 'This issue should be logged and monitored. Production can continue normally.'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-base font-bold text-slate-800 mb-2">Additional Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Describe what happened, where it occurred, and any immediate actions taken..."
            className="w-full p-4 rounded-2xl border-2 border-slate-200 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-navy-500 focus:ring-4 focus:ring-navy-500/10 resize-none transition-all"
          />
        </div>
      </main>

      <div className="sticky bottom-0 bg-slate-50 px-4 py-4 border-t border-slate-200">
        {isSubmitting ? (
          <div className="w-full py-5 rounded-2xl bg-navy-50 border-2 border-navy-200 flex items-center justify-center gap-3">
            <Loader2 size={26} className="text-navy-600 animate-spin" strokeWidth={2.5} />
            <span className="text-base font-bold text-navy-700">Submitting to Control Dashboard...</span>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!selected}
            className={`w-full py-5 rounded-2xl text-lg font-bold tracking-wide transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              selected ? 'bg-navy-900 text-white shadow-lg active:bg-navy-800' : 'bg-slate-200 text-slate-400'
            }`}
          >
            Submit Issue to Control Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
