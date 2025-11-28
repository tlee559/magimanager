"use client";

import { forwardRef } from "react";
import { useTheme, getFocusRingClasses } from "../theme-provider";

// ============================================================================
// SELECT COMPONENT
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", options, placeholder, label, error, id, ...props }, ref) => {
    const { theme } = useTheme();
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const focusRing = getFocusRingClasses(theme);

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-slate-300">
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100
            focus:outline-none focus:ring-2 ${focusRing} focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-red-500" : "border-slate-700"}
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
