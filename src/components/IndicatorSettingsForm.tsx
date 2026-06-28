import { useState } from 'react';
import { IndicatorSettings, SettingField } from '../indicators/core/types';

interface IndicatorSettingsFormProps {
  settings: IndicatorSettings;
  currentValues: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

export default function IndicatorSettingsForm({
  settings,
  currentValues,
  onChange,
}: IndicatorSettingsFormProps) {
  return (
    <div className="space-y-4">
      {Object.entries(settings).map(([key, field]) => (
        <div key={key}>
          <label className="block text-sm font-medium text-[var(--ck-text-secondary,#cbd5e1)] mb-1">
            {field.label}
          </label>
          {field.description && (
            <p className="text-xs text-[var(--ck-text-muted,#94a3b8)] mb-2">{field.description}</p>
          )}
          {renderField(key, field, currentValues[key], onChange)}
        </div>
      ))}
    </div>
  );
}

function parseColor(colorValue: string): { hex: string; opacity: number } {
  const rgbaMatch = colorValue.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);

  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]);
    const g = parseInt(rgbaMatch[2]);
    const b = parseInt(rgbaMatch[3]);
    const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;

    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { hex, opacity: Math.round(a * 100) };
  }

  return { hex: colorValue, opacity: 100 };
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = opacity / 100;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function ColorPicker({ value, defaultValue, onChange }: { value: any; defaultValue: string; onChange: (value: string) => void }) {
  const colorValue = value ?? defaultValue;
  const { hex, opacity } = parseColor(colorValue);

  const [localHex, setLocalHex] = useState(hex);
  const [localOpacity, setLocalOpacity] = useState(opacity);

  const handleColorChange = (newHex: string) => {
    setLocalHex(newHex);
    onChange(hexToRgba(newHex, localOpacity));
  };

  const handleOpacityChange = (newOpacity: number) => {
    setLocalOpacity(newOpacity);
    onChange(hexToRgba(localHex, newOpacity));
  };

  const handleTextChange = (newValue: string) => {
    const parsed = parseColor(newValue);
    setLocalHex(parsed.hex);
    setLocalOpacity(parsed.opacity);
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={localHex}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-12 h-10 rounded cursor-pointer"
        />
        <input
          type="text"
          value={colorValue}
          onChange={(e) => handleTextChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-[var(--ck-surface-2,#334155)] border border-[var(--ck-border,#334155)] rounded-[var(--ck-radius,0.5rem)] text-[var(--ck-text,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-[var(--ck-ring,#3b82f6)] font-mono text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="100"
          value={localOpacity}
          onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
          className="flex-1 h-2 bg-[var(--ck-surface-hover,#475569)] rounded-[var(--ck-radius,0.5rem)] appearance-none cursor-pointer"
        />
        <span className="text-sm text-[var(--ck-text-muted,#94a3b8)] w-12 text-right">{localOpacity}%</span>
      </div>
    </div>
  );
}

function renderField(
  key: string,
  field: SettingField,
  value: any,
  onChange: (key: string, value: any) => void
) {
  switch (field.type) {
    case 'number':
      return (
        <input
          type="number"
          value={value ?? field.defaultValue}
          onChange={(e) => onChange(key, parseFloat(e.target.value))}
          min={field.min}
          max={field.max}
          step={field.step}
          className="w-full px-3 py-2 bg-[var(--ck-surface-2,#334155)] border border-[var(--ck-border,#334155)] rounded-[var(--ck-radius,0.5rem)] text-[var(--ck-text,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-[var(--ck-ring,#3b82f6)]"
        />
      );

    case 'color':
      return (
        <ColorPicker
          value={value}
          defaultValue={field.defaultValue as string}
          onChange={(newValue) => onChange(key, newValue)}
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value ?? field.defaultValue}
            onChange={(e) => onChange(key, e.target.checked)}
            className="w-4 h-4 text-[var(--ck-accent,#2563eb)] bg-[var(--ck-surface-2,#334155)] border-[var(--ck-border,#334155)] rounded focus:ring-[var(--ck-ring,#3b82f6)]"
          />
          <span className="text-sm text-[var(--ck-text-secondary,#cbd5e1)]">
            {value ?? field.defaultValue ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      );

    case 'select':
      return (
        <select
          value={value ?? field.defaultValue}
          onChange={(e) => onChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-[var(--ck-surface-2,#334155)] border border-[var(--ck-border,#334155)] rounded-[var(--ck-radius,0.5rem)] text-[var(--ck-text,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-[var(--ck-ring,#3b82f6)]"
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'lineStyle':
      return (
        <select
          value={value ?? field.defaultValue}
          onChange={(e) => onChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-[var(--ck-surface-2,#334155)] border border-[var(--ck-border,#334155)] rounded-[var(--ck-radius,0.5rem)] text-[var(--ck-text,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-[var(--ck-ring,#3b82f6)]"
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      );

    default:
      return (
        <input
          type="text"
          value={value ?? field.defaultValue}
          onChange={(e) => onChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-[var(--ck-surface-2,#334155)] border border-[var(--ck-border,#334155)] rounded-[var(--ck-radius,0.5rem)] text-[var(--ck-text,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-[var(--ck-ring,#3b82f6)]"
        />
      );
  }
}
