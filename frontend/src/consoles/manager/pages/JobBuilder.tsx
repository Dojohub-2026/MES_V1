import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  Plus, Play, Save, Loader2, AlertCircle, X, Hash, CalendarClock, Boxes, Users, Clock,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { StageCard } from '../components/Stagecard';
import type { StageDraft } from '../components/Stagecard';

interface Blueprint {
  id: string;
  name: string;
  category: string;
  skillCategory: string | null;
  stationTag: string | null;
  estimatedDurationMinutes: number;
  isArchived: boolean;
}

interface ProductionLine {
  id: string;
  name: string;
  targetProduct: string | null;
  targetQuantity: number | null;
  unit: string | null;
  targetDate: string | null;
}

interface Operator {
  id: string;
  name: string;
  skills: string[];
}

interface MaterialRequirement {
  id: string;
  name: string;
  totalRequired: number;
  unit: string;
  wastagePct: number | null;
}

const CATEGORY_BORDER: Record<string, string> = {
  preparation: 'border-navy-300 bg-navy-50/40',
  processing: 'border-info-300 bg-info-50/40',
  packaging: 'border-warning-300 bg-warning-50/40',
  quality_control: 'border-success-300 bg-success-50/40',
};

export default function JobBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editingJobId = searchParams.get('jobId');

  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirement[]>([]);

  const [dbId, setDbId] = useState<string | null>(null);
  const [displayJobId, setDisplayJobId] = useState<string | null>(null);
  const [jobSource, setJobSource] = useState<'MANUAL' | 'ERP'>('MANUAL');

  const [lineId, setLineId] = useState('');
  const [jobName, setJobName] = useState('');
  const [productName, setProductName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState(0);
  const [unit, setUnit] = useState('Units');
  const [scheduledStartAt, setScheduledStartAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [loadingJob, setLoadingJob] = useState(!!editingJobId);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get('/blueprints'),
      api.get('/manager/lines'),
      api.get('/manager/operators'),
      editingJobId ? api.get(`/manager/jobs/${editingJobId}`) : Promise.resolve(null),
    ])
      .then(([bpRes, linesRes, opsRes, jobRes]: any[]) => {
        if (cancelled) return;
        const bps: Blueprint[] = (bpRes.data.blueprints ?? []).filter((b: Blueprint) => !b.isArchived);
        setBlueprints(bps);
        setLines(linesRes.data.lines ?? []);
        setOperators(opsRes.data ?? []);

        if (jobRes?.data) {
          const job = jobRes.data;
          setDbId(job.id);
          setDisplayJobId(job.jobId);
          setJobSource(job.source);
          setJobName(job.name);
          setProductName(job.productName || '');
          setTargetQuantity(job.targetQuantity || 0);
          setUnit(job.unit || 'Units');
          setLineId(job.lineId || '');
          if (job.scheduledStartAt) {
            setScheduledStartAt(new Date(job.scheduledStartAt).toISOString().slice(0, 16));
          }
          setMaterialRequirements(job.materialRequirements ?? []);
          setStages(
            (job.stages ?? []).map((s: any) => {
              const bp = bps.find((b) => b.id === s.blueprintId);
              return {
                tempId: s.id,
                blueprintId: s.blueprintId,
                stageName: s.stageName,
                instruction: s.instruction,
                requiresQc: s.requiresQc,
                skillCategory: bp?.skillCategory ?? null,
                estimatedDurationMinutes: s.estimatedDurationMinutes,
                stationTag: s.stationTag,
                operatorId: s.operatorId,
              };
            })
          );
        }
        setLoadingJob(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load Job Builder data.');
          setLoadingJob(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editingJobId]);

  const grouped = blueprints.reduce<Record<string, Blueprint[]>>((acc, bp) => {
    (acc[bp.category] ||= []).push(bp);
    return acc;
  }, {});

  const handleLineSelect = (id: string) => {
    setLineId(id);
    const line = lines.find((l) => l.id === id);
    if (line) {
      setProductName(line.targetProduct || '');
      setTargetQuantity(line.targetQuantity || 0);
      setUnit(line.unit || 'Units');
    }
  };

  const handleAddStage = (bp: Blueprint) => {
    setStages((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        blueprintId: bp.id,
        stageName: bp.name,
        skillCategory: bp.skillCategory,
        estimatedDurationMinutes: bp.estimatedDurationMinutes,
        stationTag: bp.stationTag,
        operatorId: null,
      },
    ]);
  };

  const handleRemoveStage = (tempId: string) => setStages((prev) => prev.filter((s) => s.tempId !== tempId));

  const handleAssignOperator = (tempId: string, operatorId: string) =>
    setStages((prev) => prev.map((s) => (s.tempId === tempId ? { ...s, operatorId } : s)));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStages((prev) => {
      const oldIndex = prev.findIndex((s) => s.tempId === active.id);
      const newIndex = prev.findIndex((s) => s.tempId === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSubmit = async (status: 'DRAFT' | 'ACTIVE') => {
    setError(null);
    if (stages.length === 0) {
      setError('Add at least one process stage.');
      return;
    }
    if (status === 'ACTIVE' && stages.some((s) => !s.operatorId)) {
      setError('Every stage needs an assigned operator before activation.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: jobName || 'Untitled Job',
        productName,
        targetQuantity,
        unit,
        lineId: lineId || null,
        scheduledStartAt: new Date(scheduledStartAt).toISOString(),
        status,
        // No explicit stageOrder field — the backend (buildStageRows)
        // derives each stage's order from its position in this array, so
        // the drag-and-drop reordering above is what actually determines
        // execution order. Sending stages out of the intended sequence
        // silently reorders the pipeline.
        stages: stages.map((s) => ({
          blueprintId: s.blueprintId,
          stageName: s.stageName,
          instruction: s.instruction ?? null,
          requiresQc: !!s.requiresQc,
          estimatedDurationMinutes: s.estimatedDurationMinutes,
          stationTag: s.stationTag,
          operatorId: s.operatorId,
        })),
      };

      const res = dbId
        ? await api.put(`/manager/jobs/${dbId}`, payload)
        : await api.post('/manager/jobs', payload);

      setSuccess(`Job "${res.data.jobId}" ${status === 'ACTIVE' ? 'activated' : 'saved as draft'}.`);
      setDisplayJobId(res.data.jobId);
      setDbId(res.data.id);
      if (status === 'ACTIVE') {
        setTimeout(() => navigate('/manager'), 1200);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save job.');
    } finally {
      setSubmitting(false);
    }
  };

  // Only highlights a stage once an error is already showing — an
  // unassigned stage has no visual warning at all until the manager
  // actually tries to activate and hits the "every stage needs an operator"
  // error below. There's no live/continuous validation as stages are added.
  const invalidStage = (s: StageDraft) => !!error && !s.operatorId;

  const totalDuration = stages.reduce((acc, s) => acc + s.estimatedDurationMinutes, 0);
  const assignedCount = stages.filter((s) => s.operatorId).length;
  const windowStart = new Date(scheduledStartAt);
  const windowEnd = new Date(windowStart.getTime() + totalDuration * 60_000);

  if (loadingJob) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-navy-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100">
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3 px-6 py-3 bg-danger-600 text-white rounded-lg shadow-lg">
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 p-1 hover:bg-danger-700 rounded transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 flex items-center justify-between p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top config bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              <Hash size={12} className="inline mr-1" />
              Job ID
            </label>
            <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono text-slate-600">
              {displayJobId || 'Assigned on save'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Production Line</label>
            <select
              value={lineId}
              onChange={(e) => handleLineSelect(e.target.value)}
              className="w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">Select line...</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Job Title</label>
            <input
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="e.g. Morning Mango Batch Run"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Target Output</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Scheduled Start</label>
            <input
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(e) => setScheduledStartAt(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>
        </div>
        {jobSource === 'ERP' && (
          <span className="px-3 py-1.5 bg-info-100 text-info-700 text-xs font-bold rounded-full flex-shrink-0">
            From ERP Work Order
          </span>
        )}
      </div>

      {materialRequirements.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-6 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
            <Boxes size={12} /> Material Requirements (from ERP)
          </p>
          <div className="flex flex-wrap gap-2">
            {materialRequirements.map((m) => (
              <span key={m.id} className="text-xs px-2.5 py-1 bg-slate-100 rounded-full text-slate-700">
                {m.name}: {m.totalRequired} {m.unit}
                {m.wastagePct ? ` (+${m.wastagePct}% wastage)` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Blueprint palette */}
        <div className="w-64 bg-white border-r border-slate-200 overflow-y-auto p-3 space-y-4">
          {Object.entries(grouped).map(([category, bps]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-1">{category.replace('_', ' ')}</h3>
              <div className="space-y-2">
                {bps.map((bp) => (
                  <div
                    key={bp.id}
                    onClick={() => handleAddStage(bp)}
                    className={`p-3 rounded-lg border-2 cursor-pointer hover:shadow-md flex items-center justify-between transition-all ${
                      CATEGORY_BORDER[bp.category] || 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{bp.name}</p>
                      <p className="text-xs text-slate-500">{bp.estimatedDurationMinutes} min</p>
                    </div>
                    <Plus size={14} className="text-navy-600" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-6">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map((s) => s.tempId)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col items-center gap-0 max-w-md mx-auto">
                  {stages.map((stage, idx) => (
                    <StageCard
                      key={stage.tempId}
                      stage={stage}
                      index={idx}
                      allStages={stages}
                      isLast={idx === stages.length - 1}
                      operators={operators}
                      onAssignOperator={handleAssignOperator}
                      onRemove={handleRemoveStage}
                      invalid={invalidStage(stage)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {stages.length === 0 && (
              <p className="text-sm text-slate-500">Click templates on the left to build the pipeline.</p>
            )}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
              <span><span className="font-semibold text-slate-700">{stages.length}</span> stage{stages.length !== 1 ? 's' : ''}</span>
              {stages.length > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1">
                    <Users size={13} />
                    <span className="font-semibold text-success-600">{assignedCount}</span>/{stages.length} assigned
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} />
                    Total: <span className="font-semibold text-slate-700">{totalDuration}</span> min
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1">
                    <CalendarClock size={13} className="text-navy-500" />
                    Window: <span className="font-semibold text-slate-700">
                      {windowStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {windowEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSubmit('DRAFT')}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <Save size={16} /> Save Draft
              </button>
              <button
                onClick={() => handleSubmit('ACTIVE')}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-navy-900 hover:bg-navy-800 text-white font-medium rounded-lg"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Activate Production Run
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
