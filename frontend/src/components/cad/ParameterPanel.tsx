import { useState, useEffect } from 'react';
import type { ParameterSchema } from '@/types';

interface ParameterPanelProps {
  parameters: Record<string, ParameterSchema>;
  values: Record<string, number | string | boolean>;
  onChange: (name: string, value: number | string | boolean) => void;
}

/**
 * Spec-sheet grammar: one quiet card, hairline-divided rows, borderless
 * mono values, hairline sliders. Descriptions and min/max live in
 * tooltips instead of permanent text.
 */
export function ParameterPanel({ parameters, values, onChange }: ParameterPanelProps) {
  const paramEntries = Object.entries(parameters);
  if (paramEntries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="divide-y divide-white/[0.04]">
        {paramEntries.map(([name, schema]) => {
          const val = values[name] ?? schema.default;
          const displayName = name.replace(/_/g, ' ');

          if (schema.type === 'bool') {
            return (
              <div key={name} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <BoolLabel displayName={displayName} description={schema.description} />
                <button
                  onClick={() => onChange(name, !val)}
                  className={`relative h-4.5 w-8 shrink-0 rounded-full transition-all duration-200 outline-none ${
                    val ? 'bg-adam-blue/90' : 'bg-white/[0.08] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  }`}
                >
                  <div
                    className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                      val ? 'translate-x-3.5 bg-white' : 'translate-x-0 bg-adam-neutral-500'
                    }`}
                  />
                </button>
              </div>
            );
          }

          if (schema.type === 'enum' && schema.options && schema.options.length > 0) {
            return (
              <div key={name} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <BoolLabel displayName={displayName} description={schema.description} />
                  <div className="relative shrink-0">
                    <select
                      value={String(val)}
                      onChange={(e) => onChange(name, e.target.value)}
                      className="cursor-pointer appearance-none border-b border-transparent bg-transparent py-0.5 pr-5 text-right text-[12px] text-adam-text-primary outline-none transition-colors hover:border-white/[0.12] focus:border-adam-blue/60"
                    >
                      {schema.options.map((opt) => (
                        <option key={opt} value={opt} className="bg-[#1C1C1C] text-adam-text-primary">
                          {opt}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-adam-text-tertiary">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (schema.type === 'string' || schema.type === 'color') {
            return (
              <div key={name} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <BoolLabel displayName={displayName} description={schema.description} />
                {schema.type === 'color' ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="relative h-4.5 w-4.5 shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/[0.1] transition-transform hover:scale-105 active:scale-95">
                      <input
                        type="color"
                        value={String(val)}
                        onChange={(e) => onChange(name, e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer scale-150 opacity-0"
                      />
                      <div className="h-full w-full" style={{ backgroundColor: String(val) }} />
                    </div>
                    <input
                      type="text"
                      value={String(val)}
                      onChange={(e) => onChange(name, e.target.value)}
                      className="w-20 border-b border-transparent bg-transparent font-mono text-[11.5px] text-adam-text-primary outline-none transition-colors placeholder:text-adam-text-tertiary hover:border-white/[0.12] focus:border-adam-blue/60"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={String(val)}
                    onChange={(e) => onChange(name, e.target.value)}
                    className="w-32 shrink-0 border-b border-transparent bg-transparent text-right text-[12px] text-adam-text-primary outline-none transition-colors placeholder:text-adam-text-tertiary hover:border-white/[0.12] focus:border-adam-blue/60"
                  />
                )}
              </div>
            );
          }

          // int / float — hairline slider row
          const min = schema.min ?? 0;
          const max = schema.max ?? 100;
          const step = schema.step ?? 1;
          const isFloat = schema.type === 'float';
          const numericVal = typeof val === 'number' ? val : Number(val) || min;
          const pct = ((numericVal - min) / (max - min)) * 100;

          return (
            <SliderParam
              key={name}
              name={name}
              displayName={displayName}
              value={numericVal}
              min={min}
              max={max}
              step={step}
              isFloat={isFloat}
              pct={pct}
              description={schema.description}
              onChange={onChange}
            />
          );
        })}
      </div>
    </div>
  );
}

function BoolLabel({ displayName, description }: { displayName: string; description?: string }) {
  return (
    <span
      className="min-w-0 truncate text-[12px] text-adam-text-secondary"
      title={description}
    >
      <span className="capitalize">{displayName}</span>
    </span>
  );
}

function SliderParam({
  name, displayName, value, min, max, step, isFloat, pct, description, onChange,
}: {
  name: string;
  displayName: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isFloat: boolean;
  pct: number;
  description?: string;
  onChange: (name: string, value: number | string | boolean) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(isFloat ? value.toFixed(1) : String(value));
    }
  }, [value, isFloat, isEditing]);

  const commitValue = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      const rounded = isFloat ? Math.round(clamped / step) * step : Math.round(clamped);
      onChange(name, rounded);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      setInputValue(isFloat ? value.toFixed(1) : String(value));
      setIsEditing(false);
    }
  };

  return (
    <div className="group/param px-3.5 py-2.5" title={description ? `${description} (range ${min}–${max})` : `Range ${min}–${max}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[12px] text-adam-text-secondary">
          <span className="capitalize">{displayName}</span>
        </span>
        <input
          type="text"
          value={isEditing ? inputValue : (isFloat ? value.toFixed(1) : String(value))}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsEditing(true);
          }}
          onFocus={() => {
            setIsEditing(true);
            setInputValue(isFloat ? value.toFixed(1) : String(value));
          }}
          onBlur={commitValue}
          onKeyDown={handleKeyDown}
          className="w-14 shrink-0 border-b border-transparent bg-transparent text-right font-mono text-[12px] tabular-nums text-adam-text-primary outline-none transition-colors hover:border-white/[0.12] focus:border-adam-blue/60"
        />
      </div>

      <div className="relative mt-2 flex h-3 items-center">
        <div className="absolute inset-0 flex items-center">
          <div className="h-0.5 w-full rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-adam-blue/70 transition-all duration-75"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(name, parseFloat(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div
          className="pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-adam-blue transition-transform duration-150 group-hover/param:scale-125"
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
    </div>
  );
}
