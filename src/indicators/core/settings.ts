import type { SettingField } from './types';

/**
 * Small builder helpers for indicator `SettingField`s. These reduce structural
 * boilerplate (the repeated `type`/`min`/`max`/`step` shape) without changing
 * any produced values — each builder returns a structurally identical object to
 * the inline literal it replaces.
 */

/** Build a `number` setting field. */
export function numberSetting(opts: {
  label: string;
  defaultValue: number;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
}): SettingField {
  return { type: 'number', ...opts };
}

/** Build a `color` setting field. */
export function colorSetting(
  label: string,
  defaultValue: string,
  description?: string,
): SettingField {
  return { type: 'color', label, defaultValue, description };
}

/**
 * Build the highly-repeated "Line Width" number field
 * (`min: 1, max: 5, step: 1`). The description is preserved per-indicator so
 * the produced field stays byte-for-byte identical to the original inline
 * literal; it defaults to a generic 'Width of the line'.
 */
export function lineWidthSetting(
  defaultValue = 2,
  description = 'Width of the line',
): SettingField {
  return {
    type: 'number',
    label: 'Line Width',
    defaultValue,
    description,
    min: 1,
    max: 5,
    step: 1,
  };
}
