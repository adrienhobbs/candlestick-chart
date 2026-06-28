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
    <div className="fixed inset-0 bg-[var(--ck-overlay,rgba(0,0,0,0.5))] flex items-center justify-center z-50">
      <div
        className="bg-[var(--ck-surface,#1e293b)] rounded-[var(--ck-radius,0.5rem)] shadow-xl w-full max-w-md"
        style={{ fontFamily: 'var(--ck-font, inherit)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--ck-border,#334155)]">
          <h2 className="text-lg font-semibold text-[var(--ck-text,#f1f5f9)]">
            {indicator.name} Settings
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--ck-text-muted,#94a3b8)] hover:text-[var(--ck-text,#f1f5f9)] transition"
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

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--ck-border,#334155)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[var(--ck-text-secondary,#cbd5e1)] hover:text-[var(--ck-text,#f1f5f9)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[var(--ck-accent,#2563eb)] hover:bg-[var(--ck-accent-hover,#1d4ed8)] text-[var(--ck-accent-text,#ffffff)] rounded-[var(--ck-radius,0.5rem)] transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
