import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { IndicatorInstance } from '../indicators/core/types';
import { indicatorRegistry } from '../indicators/core/registry';
import IndicatorSettingsForm from './IndicatorSettingsForm';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  indicator: IndicatorInstance | null;
  onSave: (indicatorId: string, settings: Record<string, any>) => void;
}

export default function SettingsDialog({
  isOpen,
  onClose,
  indicator,
  onSave,
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    if (indicator) {
      setSettings({ ...indicator.settings });
    }
  }, [indicator]);

  if (!isOpen || !indicator) return null;

  const definition = indicatorRegistry.get(indicator.definitionId);
  if (!definition) return null;

  const handleSave = () => {
    onSave(indicator.id, settings);
    onClose();
  };

  const handleChange = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">
            {indicator.name} Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <IndicatorSettingsForm
            settings={definition.settings}
            currentValues={settings}
            onChange={handleChange}
          />
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
