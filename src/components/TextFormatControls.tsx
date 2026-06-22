import { Bold, Italic, Palette, Underline } from 'lucide-react';
import type * as React from 'react';
import type { TextStyle } from '@/shared/types';

const fontOptions = [
  { label: 'Courier Prime', value: 'Courier Prime, Courier New, monospace' },
  { label: 'Courier New', value: 'Courier New, Courier, monospace' },
  { label: 'Courier', value: 'Courier, Courier New, monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Times', value: 'Times New Roman, Times, serif' },
  { label: 'Georgia', value: 'Georgia, Times New Roman, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet', value: 'Trebuchet MS, Arial, sans-serif' },
  { label: 'Segoe UI', value: 'Segoe UI, Arial, sans-serif' },
  { label: 'System Sans', value: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
  { label: 'System Serif', value: 'ui-serif, Georgia, Cambria, Times New Roman, Times, serif' },
  { label: 'System Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace' }
];

const sizeOptions = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '32pt'];
const weightOptions = [
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Bold', value: '700' },
  { label: 'Black', value: '800' }
];

interface TextFormatControlsProps {
  style?: TextStyle;
  onPatch: (patch: Partial<TextStyle>) => void;
  className?: string;
  compact?: boolean;
  includeBackground?: boolean;
}

export function TextFormatControls({ style, onPatch, className = '', compact = false, includeBackground = true }: TextFormatControlsProps) {
  const fontWeight = style?.bold ? '700' : style?.fontWeight ?? '400';

  return (
    <div className={`text-format-controls${compact ? ' text-format-controls--compact' : ''}${className ? ` ${className}` : ''}`}>
      <select
        title="Font"
        aria-label="Font"
        value={style?.fontFamily ?? fontOptions[0].value}
        onChange={(event) => onPatch({ fontFamily: event.target.value })}
      >
        {fontOptions.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <select title="Size" aria-label="Font size" value={style?.fontSize ?? '12pt'} onChange={(event) => onPatch({ fontSize: event.target.value })}>
        {sizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <select title="Weight" aria-label="Font weight" value={fontWeight} onChange={(event) => onPatch({ fontWeight: event.target.value, bold: event.target.value === '700' })}>
        {weightOptions.map((weight) => (
          <option key={weight.value} value={weight.value}>
            {weight.label}
          </option>
        ))}
      </select>
      <button title="Bold" className={style?.bold ? 'is-active' : ''} aria-pressed={Boolean(style?.bold)} onClick={() => onPatch({ bold: !style?.bold })}>
        <Bold size={15} />
      </button>
      <button title="Italic" className={style?.italic ? 'is-active' : ''} aria-pressed={Boolean(style?.italic)} onClick={() => onPatch({ italic: !style?.italic })}>
        <Italic size={15} />
      </button>
      <button title="Underline" className={style?.underline ? 'is-active' : ''} aria-pressed={Boolean(style?.underline)} onClick={() => onPatch({ underline: !style?.underline })}>
        <Underline size={15} />
      </button>
      <label className="text-format-controls__color" title="Text color">
        <Palette size={14} />
        <input aria-label="Text color" type="color" value={style?.textColor ?? '#f7fbff'} onChange={(event) => onPatch({ textColor: event.target.value })} />
      </label>
      {includeBackground && (
        <label className="text-format-controls__color text-format-controls__color--bg" title="Highlight color">
          <span>Bg</span>
          <input aria-label="Highlight color" type="color" value={style?.backgroundColor ?? '#000000'} onChange={(event) => onPatch({ backgroundColor: event.target.value })} />
        </label>
      )}
    </div>
  );
}

export function textStyleToReactStyle(style?: TextStyle): React.CSSProperties {
  if (!style) return {};
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.bold ? 700 : style.fontWeight,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecoration: style.underline ? 'underline' : undefined,
    color: style.textColor,
    backgroundColor: style.backgroundColor
  };
}
