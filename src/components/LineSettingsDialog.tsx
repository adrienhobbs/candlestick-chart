import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ChartLine } from '../types/chart';

interface LineSettingsDialogProps {
  isOpen: boolean;
  /** The line being added/edited. `null` closes the dialog. */
  line: ChartLine | null;
  onClose: () => void;
  /** Called with the edited line on save (same `id`/`price`/`type`). */
  onSave: (line: ChartLine) => void;
  /** Header title (e.g. "Add Line" / "Edit Line"). Defaults to "Line". */
  title?: string;
}

const FIELD_CLASS =
  'w-full px-3 py-2 bg-[var(--ck-surface-2,#334155)] border border-[var(--ck-border,#334155)] rounded-[var(--ck-radius,0.5rem)] text-[var(--ck-text,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-[var(--ck-ring,#3b82f6)]';
const LABEL_CLASS = 'block text-sm font-medium text-[var(--ck-text-secondary,#cbd5e1)] mb-1';

/**
 * Themed dialog to customize a price line's label, color, style, and width —
 * the line-drawing parallel to the indicator `SettingsDialog`. Reads the same
 * `--ck-*` CSS variables for theming.
 */
export default function LineSettingsDialog({
  isOpen,
  line,
  onClose,
  onSave,
  title = 'Line',
}: LineSettingsDialogProps) {
  const [draft, setDraft] = useState<ChartLine | null>(line);

  useEffect(() => {
    setDraft(line);
  }, [line]);

  if (!isOpen || !draft) return null;

  const set = (patch: Partial<ChartLine>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ck-overlay,rgba(0,0,0,0.5))]">
      <div
        className="w-full max-w-sm rounded-[var(--ck-radius,0.5rem)] bg-[var(--ck-surface,#1e293b)] shadow-xl"
        style={{ fontFamily: 'var(--ck-font, inherit)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--ck-border,#334155)] p-4">
          <h2 className="text-lg font-semibold text-[var(--ck-text,#f1f5f9)]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[var(--ck-text-muted,#94a3b8)] transition hover:text-[var(--ck-text,#f1f5f9)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className={LABEL_CLASS}>Label</label>
            <input
              type="text"
              value={draft.title ?? ''}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Support"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.color}
                onChange={(e) => set({ color: e.target.value })}
                className="h-10 w-12 cursor-pointer rounded"
              />
              <input
                type="text"
                value={draft.color}
                onChange={(e) => set({ color: e.target.value })}
                className={`${FIELD_CLASS} flex-1 font-mono text-sm`}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Line Style</label>
            <select
              value={draft.lineStyle ?? 'solid'}
              onChange={(e) => set({ lineStyle: e.target.value as ChartLine['lineStyle'] })}
              className={FIELD_CLASS}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Line Width</label>
            <input
              type="number"
              min={1}
              max={5}
              step={1}
              value={draft.lineWidth ?? 2}
              onChange={(e) => set({ lineWidth: Number(e.target.value) })}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--ck-border,#334155)] p-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[var(--ck-text-secondary,#cbd5e1)] transition hover:text-[var(--ck-text,#f1f5f9)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-[var(--ck-radius,0.5rem)] bg-[var(--ck-accent,#2563eb)] px-4 py-2 text-[var(--ck-accent-text,#ffffff)] transition hover:bg-[var(--ck-accent-hover,#1d4ed8)]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
