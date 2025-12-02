import { useState, useMemo } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { indicatorRegistry } from '../indicators/core/registry';
import { IndicatorCategory, IndicatorDefinition } from '../indicators/core/types';

interface IndicatorBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onAddIndicator: (definitionId: string) => void;
}

export default function IndicatorBrowser({
  isOpen,
  onClose,
  onAddIndicator,
}: IndicatorBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<IndicatorCategory | 'All'>('All');

  const categories = useMemo(() => {
    return ['All', ...Object.values(IndicatorCategory)];
  }, []);

  const filteredIndicators = useMemo(() => {
    let indicators = indicatorRegistry.getAll();

    if (selectedCategory !== 'All') {
      indicators = indicators.filter(
        (ind) => ind.metadata.category === selectedCategory
      );
    }

    if (searchQuery.trim()) {
      indicators = indicatorRegistry.search(searchQuery);
      if (selectedCategory !== 'All') {
        indicators = indicators.filter(
          (ind) => ind.metadata.category === selectedCategory
        );
      }
    }

    return indicators;
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleAddIndicator = (definitionId: string) => {
    onAddIndicator(definitionId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">Add Indicator</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search indicators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category as IndicatorCategory | 'All')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filteredIndicators.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>No indicators found</p>
              {searchQuery && (
                <p className="text-sm mt-2">
                  Try adjusting your search or category filter
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredIndicators.map((indicator) => (
                <IndicatorCard
                  key={indicator.metadata.id}
                  indicator={indicator}
                  onAdd={() => handleAddIndicator(indicator.metadata.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface IndicatorCardProps {
  indicator: IndicatorDefinition;
  onAdd: () => void;
}

function IndicatorCard({ indicator, onAdd }: IndicatorCardProps) {
  const getCategoryColor = (category: IndicatorCategory) => {
    switch (category) {
      case IndicatorCategory.TREND:
        return 'bg-blue-500/20 text-blue-400';
      case IndicatorCategory.MOMENTUM:
        return 'bg-purple-500/20 text-purple-400';
      case IndicatorCategory.VOLATILITY:
        return 'bg-orange-500/20 text-orange-400';
      case IndicatorCategory.VOLUME:
        return 'bg-green-500/20 text-green-400';
      case IndicatorCategory.OSCILLATORS:
        return 'bg-pink-500/20 text-pink-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-slate-100 font-medium">{indicator.metadata.name}</h3>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(
                indicator.metadata.category
              )}`}
            >
              {indicator.metadata.category}
            </span>
          </div>
          <p className="text-sm text-slate-400">{indicator.metadata.description}</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium opacity-0 group-hover:opacity-100"
        >
          <Plus size={16} />
          Add
        </button>
      </div>
    </div>
  );
}
