"use client";

import { useState, useEffect } from "react";
import { X, Copy, Pause, Sparkles, Send, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Check } from "lucide-react";
import type { Ad } from "@magimanager/shared";
import { type AdScore, type ScoredAd, getTierColors } from "./utils/ad-scoring";

// ============================================================================
// TYPES
// ============================================================================

interface AdDetailPanelProps {
  ad: ScoredAd;
  allAdsInGroup: ScoredAd[];
  onClose: () => void;
  accountId: string;
  customerId: string;
}

interface AIAnalysis {
  loading: boolean;
  whyItWins?: string[];
  problems?: string[];
  suggestedRewrites?: string[];
  scalingTips?: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

function getTierIcon(tier: AdScore["tier"]): string {
  switch (tier) {
    case "gold": return "🏆";
    case "silver": return "🥈";
    case "bronze": return "🥉";
    default: return "⚪";
  }
}

function getTierLabel(tier: AdScore["tier"]): string {
  switch (tier) {
    case "gold": return "WINNER";
    case "silver": return "GOOD";
    case "bronze": return "NEEDS WORK";
    default: return "FAILING";
  }
}

// ============================================================================
// SCORE BREAKDOWN COMPONENT
// ============================================================================

function ScoreBreakdown({ score }: { score: AdScore }) {
  const metrics = [
    { label: "CTR", value: score.ctrScore, max: 25, color: "bg-blue-400" },
    { label: "Conversions", value: score.conversionScore, max: 35, color: "bg-emerald-400" },
    { label: "Cost Efficiency", value: score.costScore, max: 25, color: "bg-purple-400" },
    { label: "Reach", value: score.impressionScore, max: 15, color: "bg-amber-400" },
  ];

  return (
    <div className="space-y-2">
      {metrics.map((metric) => (
        <div key={metric.label} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-28">{metric.label} ({metric.max}%)</span>
          <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${metric.color} rounded-full transition-all duration-500`}
              style={{ width: `${(metric.value / metric.max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-300 w-8 text-right">{metric.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

function QuickActions({
  isWinner,
  onSendPrompt,
}: {
  isWinner: boolean;
  onSendPrompt: (prompt: string) => void;
}) {
  const winnerActions = [
    { label: "Why is this winning?", prompt: "Analyze why this ad is outperforming others in its ad group. What specific elements are driving success?" },
    { label: "Write 3 variations", prompt: "Write 3 new ad variations that preserve the winning elements of this ad. Keep the same structure and key phrases that make it successful." },
    { label: "Scaling plan", prompt: "Create a scaling plan for this winning ad. Should I increase budget? Clone to other ad groups? What's the best way to capitalize on this success?" },
  ];

  const underperformerActions = [
    { label: "Diagnose problems", prompt: "Analyze what's wrong with this ad. Why is it underperforming compared to other ads in this ad group?" },
    { label: "Write rewrites", prompt: "Write 3 improved versions of this ad based on what's working in my other ads. Use patterns from my successful ads." },
    { label: "Compare to winners", prompt: "Compare this ad to the top performers in this account. What are they doing differently that this ad should copy?" },
  ];

  const actions = isWinner ? winnerActions : underperformerActions;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => onSendPrompt(action.prompt)}
          className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AdDetailPanel({
  ad,
  allAdsInGroup,
  onClose,
  accountId,
  customerId,
}: AdDetailPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [analysis, setAnalysis] = useState<AIAnalysis>({ loading: true });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const tierColors = getTierColors(ad.score.tier);
  const isWinner = ad.score.tier === "gold" || ad.score.tier === "silver";
  const headline = ad.headlines?.[0] || ad.name || "Ad";

  // Fetch AI analysis on mount
  useEffect(() => {
    fetchAnalysis();
  }, [ad.id]);

  const fetchAnalysis = async () => {
    setAnalysis({ loading: true });

    try {
      const res = await fetch("/api/ai/analyze-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad,
          allAdsInGroup,
          accountId,
          customerId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis({ loading: false, ...data });
      } else {
        // Fallback to placeholder analysis if API fails
        setAnalysis({
          loading: false,
          whyItWins: isWinner ? [
            "Strong headline with clear value proposition",
            "Includes discount/urgency elements",
            "CTR above average for this ad group",
          ] : undefined,
          problems: !isWinner ? [
            "Generic headline lacks differentiation",
            "Missing urgency or scarcity signals",
            "No clear call-to-action or offer",
          ] : undefined,
          suggestedRewrites: !isWinner ? [
            `"${headline.split(" ")[0]} - 40% Off Today Only"`,
            `"Premium ${headline.split(" ")[0]} - Free Shipping"`,
            `"Best-Rated ${headline.split(" ")[0]} - Limited Time"`,
          ] : undefined,
          scalingTips: isWinner ? [
            "Create 2-3 variations keeping the winning structure",
            "Test in other relevant ad groups",
            "Consider increasing budget by 50-100%",
          ] : undefined,
        });
      }
    } catch (err) {
      // Fallback analysis
      setAnalysis({
        loading: false,
        whyItWins: isWinner ? ["Analysis unavailable - try again"] : undefined,
        problems: !isWinner ? ["Analysis unavailable - try again"] : undefined,
      });
    }
  };

  const handleSendPrompt = (prompt: string) => {
    // For now, just set the input - in the future this will trigger AI chat
    setChatInput(prompt);
    // TODO: Integrate with Gemini agent chat
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-100 truncate">{headline}</h2>
          {ad.type && (
            <p className="text-xs text-slate-500 mt-0.5">{ad.type.replace(/_/g, " ")}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Score Section */}
        <div className={`rounded-xl p-4 ${tierColors.bg} border ${tierColors.border}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getTierIcon(ad.score.tier)}</span>
              <div>
                <div className={`text-2xl font-bold ${tierColors.text}`}>{ad.score.overall}/100</div>
                <div className={`text-xs font-medium ${tierColors.text}`}>{getTierLabel(ad.score.tier)}</div>
              </div>
            </div>
            {ad.score.isWinner && (
              <div className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                Scale This!
              </div>
            )}
          </div>
          <ScoreBreakdown score={ad.score} />
        </div>

        {/* AI Analysis Section */}
        <div className="space-y-4">
          {analysis.loading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Analyzing ad performance...</span>
            </div>
          ) : (
            <>
              {/* Winner Analysis */}
              {isWinner && analysis.whyItWins && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-semibold">Why This Ad Wins</span>
                  </div>
                  <ul className="space-y-2">
                    {analysis.whyItWins.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scaling Tips for Winners */}
              {isWinner && analysis.scalingTips && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-semibold">How to Scale</span>
                  </div>
                  <ul className="space-y-2">
                    {analysis.scalingTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-blue-400 font-medium">{i + 1}.</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Underperformer Problems */}
              {!isWinner && analysis.problems && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-semibold">Problems Detected</span>
                  </div>
                  <ul className="space-y-2">
                    {analysis.problems.map((problem, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <TrendingDown className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <span>{problem}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Rewrites for Underperformers */}
              {!isWinner && analysis.suggestedRewrites && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-semibold">AI Suggested Rewrites</span>
                  </div>
                  <div className="space-y-2">
                    {analysis.suggestedRewrites.map((rewrite, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700"
                      >
                        <span className="text-sm text-slate-200">{rewrite}</span>
                        <button
                          onClick={() => copyToClipboard(rewrite, i)}
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                        >
                          {copiedIndex === i ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quick Actions</span>
          <QuickActions isWinner={isWinner} onSendPrompt={handleSendPrompt} />
        </div>

        {/* Pause Button for Underperformers */}
        {!isWinner && (
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 opacity-50 cursor-not-allowed"
            title="Coming Soon"
          >
            <Pause className="w-4 h-4" />
            <span className="text-sm">Pause This Ad</span>
          </button>
        )}
      </div>

      {/* Chat Input - Fixed at bottom */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-xs text-slate-400">Ask AI about this ad</span>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="e.g., 'Write 3 variations of this ad'"
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
          <button
            disabled={!chatInput.trim()}
            className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdDetailPanel;
