import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Clock, MapPin, CalendarClock, ShieldCheck, AlertTriangle, ArrowDown } from 'lucide-react';

interface Operator {
  id: string;
  name: string;
  skills: string[];
}

export interface StageDraft {
  tempId: string;
  blueprintId: string | null;
  stageName: string;
  instruction?: string | null;
  skillCategory?: string | null;
  estimatedDurationMinutes: number;
  stationTag: string | null;
  operatorId: string | null;
}

interface StageCardProps {
  stage: StageDraft;
  index: number;
  allStages: StageDraft[];
  isLast: boolean;
  operators: Operator[];
  onAssignOperator: (tempId: string, operatorId: string) => void;
  onRemove: (tempId: string) => void;
  invalid: boolean;
}

function computeWindow(allStages: StageDraft[], index: number, baseStart: Date) {
  let offset = 0;
  for (let i = 0; i < index; i++) {
    offset += allStages[i]?.estimatedDurationMinutes || 0;
  }
  const start = new Date(baseStart.getTime() + offset * 60_000);
  const end = new Date(start.getTime() + (allStages[index]?.estimatedDurationMinutes || 0) * 60_000);
  return { start, end };
}

export function StageCard({ stage, index, allStages, isLast, operators, onAssignOperator, onRemove, invalid }: StageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.tempId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const assignedOperator = operators.find((op) => op.id === stage.operatorId);
  const isCertified = !stage.skillCategory || (assignedOperator?.skills.includes(stage.skillCategory) ?? false);
  const showSkillWarning = !!assignedOperator && !!stage.skillCategory && !isCertified;

  const { start, end } = computeWindow(allStages, index, new Date());

  return (
    <div className="flex flex-col items-center">
      <div
        ref={setNodeRef}
        style={style}
        className={`relative bg-white rounded-lg border p-4 shadow-sm w-full ${
          invalid ? 'ring-2 ring-red-500' : showSkillWarning ? 'ring-2 ring-warning-400' : 'border-slate-200'
        }`}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${stage.stageName} to reorder`}
          title="Drag to reorder"
          className="absolute left-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing cursor-grab touch-none"
        >
          <GripVertical size={16} />
        </button>

        <button
          type="button"
          onClick={() => onRemove(stage.tempId)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
        >
          <X size={12} />
        </button>

        <div className="pl-8">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900">{stage.stageName}</h4>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-navy-100 text-navy-700 rounded flex-shrink-0">
              #{index + 1}
            </span>
          </div>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">Drag to reorder</p>
          {stage.instruction && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{stage.instruction}</p>}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 flex-wrap">
            <Clock size={12} />
            <span>{stage.estimatedDurationMinutes} min</span>
            {stage.stationTag && (
              <>
                <MapPin size={12} />
                <span>{stage.stationTag}</span>
              </>
            )}
          </div>
          {stage.estimatedDurationMinutes > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <CalendarClock size={11} />
              <span>
                {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          <label className="block text-xs font-medium text-slate-600 mt-3 mb-1">Assigned Operator</label>
          <select
            value={stage.operatorId || ''}
            onChange={(e) => onAssignOperator(stage.tempId, e.target.value)}
            className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm ${
              invalid ? 'border-red-500' : 'border-slate-200'
            }`}
          >
            <option value="">Select operator...</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>
                {stage.skillCategory && op.skills.includes(stage.skillCategory) ? '✓ ' : ''}
                {op.name}
              </option>
            ))}
          </select>

          {assignedOperator && stage.skillCategory && (
            <div
              className={`flex items-center gap-2 mt-2 text-xs px-2 py-1.5 rounded-lg ${
                isCertified ? 'text-success-700 bg-success-50' : 'text-warning-700 bg-warning-50'
              }`}
            >
              {isCertified ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
              <span>
                {isCertified
                  ? `Certified for ${stage.skillCategory}`
                  : `Not certified for ${stage.skillCategory}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {!isLast && <ArrowDown size={16} className="text-navy-300 my-1 flex-shrink-0" />}
    </div>
  );
}
