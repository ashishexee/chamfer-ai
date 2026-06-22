import { useState, useEffect } from 'react';
import type { ParameterSchema } from '@/types';

interface ParameterPanelProps {
  parameters: Record<string, ParameterSchema>;
  values: Record<string, number | string | boolean>;
  onChange: (name: string, value: number | string | boolean) => void;
}

export function ParameterPanel({ parameters, values, onChange }: ParameterPanelProps) {
  const paramEntries = Object.entries(parameters);
  if (paramEntries.length === 0) return null;

  return (
    <div className="space-y-3">
      {paramEntries.map(([name, schema]) => {
        const val = values[name] ?? schema.default;
        const displayName = name.replace(/_/g, ' ');

        if (schema.type === 'bool') {
          return (
            <div key={name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-adam-text-secondary font-medium tracking-wide capitalize">
                  {displayName}
                </span>
                <button
                  onClick={() => onChange(name, !val)}
                  className={`w-10 h-5 rounded-full transition-colors ${val ? 'bg-adam-blue' : 'bg-adam-neutral-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {schema.description && (
                <p className="text-[10px] text-adam-text-tertiary mt-1.5">{schema.description}</p>
              )}
            </div>
          );
        }

        if (schema.type === 'enum' && schema.options && schema.options.length > 0) {
          return (
            <div key={name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-adam-text-secondary font-medium tracking-wide capitalize">
                  {displayName}
                </span>
              </div>
              <select
                value={String(val)}
                onChange={(e) => onChange(name, e.target.value)}
                className="w-full text-xs bg-adam-neutral-800 border border-adam-neutral-700 rounded px-3 py-2 text-adam-text-secondary"
              >
                {schema.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {schema.description && (
                <p className="text-[10px] text-adam-text-tertiary mt-1.5">{schema.description}</p>
              )}
            </div>
          );
        }

        if (schema.type === 'string' || schema.type === 'color') {
          return (
            <div key={name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-adam-text-secondary font-medium tracking-wide capitalize">
                  {displayName}
                </span>
              </div>
              <input
                type={schema.type === 'color' ? 'color' : 'text'}
                value={String(val)}
                onChange={(e) => onChange(name, e.target.value)}
                className="w-full text-xs bg-adam-neutral-800 border border-adam-neutral-700 rounded px-3 py-2 text-adam-text-secondary"
              />
              {schema.description && (
                <p className="text-[10px] text-adam-text-tertiary mt-1.5">{schema.description}</p>
              )}
            </div>
          );
        }

        // int / float - slider with input field
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
    <div className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors">
      <div className="px-4 pt-3 pb-1.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-adam-text-secondary font-medium tracking-wide capitalize">
            {displayName}
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
            className="w-16 text-right text-xs text-adam-blue font-mono font-semibold tabular-nums bg-transparent border border-transparent rounded px-1 py-0.5 outline-none hover:border-adam-neutral-600 focus:border-adam-blue/60 focus:bg-adam-neutral-800/60 transition-all"
          />
        </div>
        {description && (
          <p className="text-[10px] text-adam-text-tertiary mb-1.5">{description}</p>
        )}
        <div className="relative h-6 flex items-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-1.5 rounded-full bg-adam-neutral-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-adam-blue/80 to-adam-blue transition-all duration-75"
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
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute w-4 h-4 rounded-full bg-white shadow-md border-2 border-adam-blue pointer-events-none transition-transform group-hover:scale-110"
            style={{ left: `calc(${pct}% - 8px)` }}
          />
        </div>
      </div>
      <div className="flex justify-between px-4 pb-2.5 pt-0.5">
        <span className="text-[10px] text-adam-text-tertiary font-mono">{min}</span>
        <span className="text-[10px] text-adam-text-tertiary font-mono">{max}</span>
      </div>
    </div>
  );
}
