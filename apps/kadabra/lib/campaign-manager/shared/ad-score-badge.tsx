"use client";

import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AdScore } from "../utils/ad-scoring";
import { getTierColors } from "../utils/ad-scoring";

// ============================================================================
// TYPES
// ============================================================================

interface AdScoreBadgeProps {
  score: AdScore;
  showBreakdown?: boolean;
  size?: "sm" | "md" | "lg";
}

interface ScoreBreakdownProps {
  score: AdScore;
}

// ============================================================================
// SCORE BREAKDOWN TOOLTIP
// ============================================================================

export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
  const metrics = [
    { label: "CTR", value: score.ctrScore, max: 25, color: "bg-blue-500" },
    { label: "Conversions", value: score.conversionScore, max: 35, color: "bg-emerald-500" },
    { label: "Cost Efficiency", value: score.costScore, max: 25, color: "bg-amber-500" },
    { label: "Impressions", value: score.impressionScore, max: 15, color: "bg-violet-500" },
  ];

  return (
    <div className="space-y-3 p-3 min-w-[200px]">
      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
        <span className="text-sm font-medium text-slate-200">Performance Score</span>
        <span className="text-lg font-bold text-slate-100">{score.overall}/100</span>
      </div>

      {metrics.map((metric) => (
        <div key={metric.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{metric.label}</span>
            <span className="text-slate-300">{metric.value}/{metric.max}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${metric.color} rounded-full transition-all`}
              style={{ width: `${(metric.value / metric.max) * 100}%` }}
            />
          </div>
        </div>
      ))}

      {score.isWinner && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400 font-medium">Top Performer</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN BADGE COMPONENT
// ============================================================================

export function AdScoreBadge({ score, showBreakdown = false, size = "md" }: AdScoreBadgeProps) {
  const tierColors = getTierColors(score.tier);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className="relative group">
      <div
        className={`inline-flex items-center rounded-full border ${tierColors.bg} ${tierColors.text} ${tierColors.border} ${sizeClasses[size]} font-medium`}
      >
        <span>{score.overall}</span>
        {score.isWinner && (
          <Trophy className={iconSizes[size]} />
        )}
      </div>

      {/* Hover tooltip with breakdown */}
      {showBreakdown && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
            <ScoreBreakdown score={score} />
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-8 border-transparent border-t-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INLINE SCORE INDICATOR (for compact views)
// ============================================================================

interface ScoreIndicatorProps {
  score: number;
  previousScore?: number;
}

export function ScoreIndicator({ score, previousScore }: ScoreIndicatorProps) {
  const change = previousScore !== undefined ? score - previousScore : 0;

  const getScoreColor = () => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="flex items-center gap-1">
      <span className={`font-medium ${getScoreColor()}`}>{score}</span>
      {change !== 0 && (
        <span className={`flex items-center text-xs ${change > 0 ? "text-emerald-400" : "text-red-400"}`}>
          {change > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {Math.abs(change)}
        </span>
      )}
    </div>
  );
}
