import { useEffect, useState, useCallback } from 'react';
import {
  Layers, Plus, Search, Archive, X, Clock, MapPin,
  FileText, CheckSquare, BarChart3, AlertTriangle,
  Edit3, Loader2,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { BlueprintBuilderForm } from '../components/BlueprintBuilderForm';

export interface Blueprint {
  id: string;
  name: string;
  description: string | null;
  category: string;
  stationTag: string | null;
  estimatedDurationMinutes: number;
  isArchived: boolean;
  guidelinesEnabled: boolean;
  checklistEnabled: boolean;
  quantityLoggingEnabled: boolean;
  faultCategoriesEnabled: boolean;
}

const categoryLabels: Record<string, string> = {
  preparation: 'Preparation',
  processing: 'Processing',
  packaging: 'Packaging',
  quality_control: 'Quality Control',
};

const categoryBadgeStyles: Record<string, string> = {
  preparation: 'bg-navy-100 text-navy-700 border-navy-200',
  processing: 'bg-info-100 text-info-700 border-info-200',
  packaging: 'bg-warning-100 text-warning-700 border-warning-200',
  quality_control: 'bg-success-100 text-success-700 border-success-200',
};

function BlueprintCard({ blueprint, onEdit, onArchive }: {
  blueprint: Blueprint;
  onEdit: (id: string) => void;
  onArchive: (id: string, isArchived: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const enabledFeatures = [
    { on: blueprint.guidelinesEnabled, label: 'Guidelines', icon: <FileText size={12} /> },
    { on: blueprint.checklistEnabled, label: 'Checklist', icon: <CheckSquare size={12} /> },
    { on: blueprint.quantityLoggingEnabled, label: 'Quantity', icon: <BarChart3 size={12} /> },
    { on: blueprint.faultCategoriesEnabled, label: 'Faults', icon: <AlertTriangle size={12} /> },
  ].filter((f) => f.on);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/50 shadow-card relative overflow-hidden ${blueprint.isArchived ? 'opacity-60' : ''}`}>
      {confirming && (
        <div className="absolute inset-0 bg-danger-900/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
          <AlertTriangle size={28} className="text-white mb-3" />
          <p className="text-white font-medium text-center mb-4 text-sm">
            {blueprint.isArchived ? 'Restore this blueprint?' : 'Archive this blueprint?'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="px-4 py-2 bg-white/20 text-white font-medium rounded-lg hover:bg-white/30 text-sm">
              Cancel
            </button>
            <button
              onClick={() => { onArchive(blueprint.id, !blueprint.isArchived); setConfirming(false); }}
              className="px-4 py-2 bg-danger-600 text-white font-medium rounded-lg hover:bg-danger-500 text-sm"
            >
              {blueprint.isArchived ? 'Restore' : 'Archive'}
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{blueprint.name}</h3>
            {blueprint.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{blueprint.description}</p>}
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${categoryBadgeStyles[blueprint.category] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {categoryLabels[blueprint.category] || blueprint.category}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
          <div className="flex items-center gap-1"><Clock size={12} /><span>{blueprint.estimatedDurationMinutes} min</span></div>
          {blueprint.stationTag && <div className="flex items-center gap-1"><MapPin size={12} /><span>{blueprint.stationTag}</span></div>}
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 mb-3">
          {enabledFeatures.length > 0 ? (
            enabledFeatures.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-navy-50 text-navy-700 text-[10px] font-medium rounded-full">
                {f.icon}{f.label}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">No features enabled</span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onEdit(blueprint.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-lg transition-all"
          >
            <Edit3 size={13} /> Edit
          </button>
          <button
            onClick={() => setConfirming(true)}
            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-all"
          >
            <Archive size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function BlueprintLibrary() {
  const [blueprints, setBlueprints] = useState<Blueprint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadBlueprints = useCallback(() => {
    api.get<{ blueprints: Blueprint[] }>('/blueprints')
      .then((res) => setBlueprints(res.data.blueprints))
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load blueprints.'));
  }, []);

  useEffect(() => { loadBlueprints(); }, [loadBlueprints]);

  const handleArchive = async (id: string, isArchived: boolean) => {
    try {
      await api.patch(`/blueprints/${id}/archive`, { isArchived });
      loadBlueprints();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update archive status.');
    }
  };

  const handleSaved = () => {
    setMode('list');
    setEditingId(null);
    loadBlueprints();
  };

  if (mode !== 'list') {
    return (
      <BlueprintBuilderForm
        blueprintId={mode === 'edit' ? editingId : null}
        onCancel={() => { setMode('list'); setEditingId(null); }}
        onSaved={handleSaved}
      />
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700">
        <AlertTriangle size={20} strokeWidth={2.5} />{error}
      </div>
    );
  }

  if (!blueprints) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 size={28} className="animate-spin" strokeWidth={2.5} />
      </div>
    );
  }

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'preparation', label: 'Preparation' },
    { key: 'processing', label: 'Processing' },
    { key: 'packaging', label: 'Packaging' },
    { key: 'quality_control', label: 'Quality Control' },
  ];

  const filtered = blueprints.filter((bp) => {
    const matchesSearch = bp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = activeCategory === 'all' || bp.category === activeCategory;
    const matchesArchive = showArchived ? bp.isArchived : !bp.isArchived;
    return matchesSearch && matchesCategory && matchesArchive;
  });

  const activeCount = blueprints.filter((b) => !b.isArchived).length;
  const archivedCount = blueprints.filter((b) => b.isArchived).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={24} className="text-navy-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Blueprint Library</h1>
            <p className="text-sm text-slate-500">{activeCount} active {archivedCount > 0 && `· ${archivedCount} archived`}</p>
          </div>
        </div>
        <button
          onClick={() => setMode('create')}
          className="flex items-center gap-2 px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white font-medium rounded-lg shadow-sm transition-all"
        >
          <Plus size={18} /> Create Blueprint
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search blueprints..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeCategory === c.key ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            showArchived ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Archive size={16} /> Archived
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-2xl border border-slate-200/50">
          <Layers size={48} className="text-slate-300 mb-4" />
          <h3 className="font-medium text-slate-600 mb-2">No blueprints found</h3>
          <p className="text-sm text-slate-400">
            {searchQuery ? 'Try adjusting your search or filters' : 'Create your first blueprint to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((bp) => (
            <BlueprintCard
              key={bp.id}
              blueprint={bp}
              onEdit={(id) => { setEditingId(id); setMode('edit'); }}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}