"use client";

import { forwardRef } from "react";
import { useTheme, getPrimaryButtonClasses } from "../theme-provider";

// ============================================================================
// BUTTON COMPONENT
// ============================================================================

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      icon,
      iconPosition = "left",
      children,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();
    const isDisabled = disabled || loading;

    const getVariantClasses = (): string => {
      switch (variant) {
        case "primary":
          return `${getPrimaryButtonClasses(theme)} text-slate-950 font-medium`;
        case "secondary":
          return "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700";
        case "outline":
          return "bg-transparent text-slate-300 hover:bg-slate-800 border border-slate-700";
        case "ghost":
          return "bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white";
        case "danger":
          return "bg-red-600 text-white hover:bg-red-500 font-medium";
        default:
          return "";
      }
    };

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-2 rounded-lg transition
          ${getVariantClasses()}
          ${sizeClasses[size]}
          ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}
          ${className}
        `}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {icon && iconPosition === "left" && icon}
            {children}
            {icon && iconPosition === "right" && icon}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

// ============================================================================
// LOADING SPINNER
// ============================================================================

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
