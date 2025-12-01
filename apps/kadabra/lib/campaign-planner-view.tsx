"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Link2,
  FileText,
  Target,
  DollarSign,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Download,
  Clock,
  RefreshCw,
  Building2,
  Users,
  TrendingUp,
  ClipboardList,
  BarChart3,
  MessageCircle,
  RotateCcw,
  ImageIcon,
} from "lucide-react";
import { INDUSTRY_BENCHMARKS } from "./campaign-planner-agent";

// ============================================================================
// TYPES
// ============================================================================

interface CampaignPlan {
  id: string;
  name: string;
  status: "DRAFT" | "PROCESSING" | "COMPLETED" | "ARCHIVED" | "FAILED";
  productUrl?: string;
  productDescription?: string;
  targetAudience?: string;
  monthlyBudget?: number;
  goals?: string;
  // v2 Enhancement fields
  competitorUrl?: string;
  industry?: string;
  plan?: GeneratedPlan;
  processingError?: string;
  createdAt: string;
  updatedAt: string;
}

// v2 Enhancement types
interface CompetitorAnalysis {
  valueProposition: string;
  targetAudience: string;
  keyOffers: string[];
  likelyKeywords: string[];
  differentiationStrategy: string;
  competitiveAdvantages: string[];
}

interface IndustryBenchmarks {
  industry: string;
  expectedCpa: { low: number; high: number; target: number };
  expectedCtr: number;
  expectedCvr: number;
  planVsBenchmark: string;
}

interface ImplementationStep {
  phase: number;
  title: string;
  description: string;
  substeps: {
    action: string;
    details: string;
    copyValue?: string;
  }[];
}

interface GeneratedPlan {
  summary: {
    productAnalysis: string;
    targetMarket: string;
    uniqueSellingPoints: string[];
    competitiveAdvantages: string[];
  };
  campaigns: CampaignStructure[];
  budgetBreakdown: {
    recommendedMonthlyBudget: number;
    estimatedCpc: { min: number; max: number };
    estimatedClicksPerMonth: { min: number; max: number };
    estimatedConversions: { min: number; max: number };
  };
  timeline: {
    phase: string;
    duration: string;
    actions: string[];
  }[];
  nextSteps: string[];
  // v2 Enhancement fields
  competitorAnalysis?: CompetitorAnalysis;
  industryBenchmarks?: IndustryBenchmarks;
  implementationGuide?: ImplementationStep[];
}

interface CampaignStructure {
  campaignName: string;
  campaignType: string;
  biddingStrategy: string;
  targetCpa?: number;
  dailyBudget: number;
  adGroups: AdGroupStructure[];
}

interface AdGroupStructure {
  name: string;
  theme: string;
  keywords: {
    theme: string;
    keywords: KeywordItem[];
  };
  ads: AdCopy[];
}

interface KeywordItem {
  keyword: string;
  matchType: string;
  estimatedVolume: string;
  competition: string;
  estimatedCpc: string;
  intent: string;
}

interface AdCopy {
  headlines: string[];
  descriptions: string[];
  callToAction: string;
}

// ============================================================================
// STEP 1: INPUT FORM
// ============================================================================

function InputStep({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: {
    productUrl?: string;
    productDescription?: string;
    targetAudience?: string;
    monthlyBudget?: string;
    goals?: string;
    name?: string;
    competitorUrl?: string;
    industry?: string;
  }) => void;
  isLoading: boolean;
}) {
  const [productUrl, setProductUrl] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [goals, setGoals] = useState("");
  const [name, setName] = useState("");
  // v2 Enhancement fields
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [industry, setIndustry] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productUrl && !productDescription) return;
    onSubmit({
      productUrl,
      productDescription,
      targetAudience,
      monthlyBudget,
      goals,
      name,
      competitorUrl: competitorUrl || undefined,
      industry: industry || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">
          Create Campaign Plan
        </h2>
        <p className="text-sm text-slate-400">
          Enter your product details and let AI create a comprehensive Google Ads campaign plan
        </p>
      </div>

      {/* Plan Name */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Plan Name (Optional)
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Campaign Plan"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* Industry Selection - v2 Enhancement */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-violet-400" />
            Industry (Recommended)
          </div>
        </label>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 transition appearance-none cursor-pointer"
        >
          <option value="">Select your industry...</option>
          {Object.entries(INDUSTRY_BENCHMARKS).map(([key, data]) => (
            <option key={key} value={key}>
              {data.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Helps us provide accurate industry benchmarks and realistic expectations
        </p>
      </div>

      {/* Product URL */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-violet-400" />
            Product/Landing Page URL
          </div>
        </label>
        <input
          type="url"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          placeholder="https://example.com/product"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* Product Description */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-400" />
            Product/Service Description *
          </div>
        </label>
        <textarea
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
          placeholder="Describe your product or service in detail. Include features, benefits, pricing, and what makes it unique..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
        />
        <p className="text-xs text-slate-500 mt-1">
          The more details you provide, the better your campaign plan will be
        </p>
      </div>

      {/* Target Audience */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-violet-400" />
            Target Audience (Optional)
          </div>
        </label>
        <textarea
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          placeholder="Who are your ideal customers? Include demographics, interests, pain points..."
          rows={3}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
        />
      </div>

      {/* Goals */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Campaign Goals (Optional)
        </label>
        <input
          type="text"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="e.g., Generate leads, Drive sales, Increase brand awareness"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
        />
      </div>

      {/* Monthly Budget */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-violet-400" />
            Monthly Budget (Optional)
          </div>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <input
            type="number"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(e.target.value)}
            placeholder="3000"
            className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>
      </div>

      {/* Competitor URL - v2 Enhancement */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            Competitor URL (Optional)
          </div>
        </label>
        <input
          type="url"
          value={competitorUrl}
          onChange={(e) => setCompetitorUrl(e.target.value)}
          placeholder="https://competitor.com"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
        />
        <p className="text-xs text-slate-500 mt-1">
          We'll analyze their positioning and suggest how to differentiate
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || (!productUrl && !productDescription)}
        className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating Plan...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate Campaign Plan
          </>
        )}
      </button>
    </form>
  );
}

// ============================================================================
// STEP 2: PROCESSING
// ============================================================================

function ProcessingStep({ planId }: { planId: string }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
        </div>
        <div className="absolute inset-0 rounded-full animate-ping bg-violet-500/10" />
      </div>

      <h3 className="text-lg font-medium text-slate-100 mb-2">
        Generating Your Campaign Plan{dots}
      </h3>
      <p className="text-sm text-slate-400 text-center max-w-md">
        Our AI is analyzing your product, researching keywords, and creating a comprehensive campaign strategy. This usually takes 30-60 seconds.
      </p>

      <div className="mt-8 space-y-3 text-sm">
        <div className="flex items-center gap-3 text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          <span>Analyzing product details</span>
        </div>
        <div className="flex items-center gap-3 text-violet-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Researching keywords</span>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <Clock className="w-4 h-4" />
          <span>Creating campaign structure</span>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <Clock className="w-4 h-4" />
          <span>Generating ad copy</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: PLAN DISPLAY
// ============================================================================

function PlanDisplay({
  plan,
  onBack,
  onDelete,
  onRetry,
  onChat,
  onCreateAds,
}: {
  plan: CampaignPlan;
  onBack: () => void;
  onDelete?: (planId: string) => void;
  onRetry?: (plan: CampaignPlan) => void;
  onChat?: (plan: CampaignPlan) => void;
  onCreateAds?: (plan: CampaignPlan) => void;
}) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(new Set([0]));
  const [expandedAdGroups, setExpandedAdGroups] = useState<Set<string>>(new Set(["0-0"]));
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const generatedPlan = plan.plan as GeneratedPlan | undefined;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this plan?")) return;
    setIsDeleting(true);
    await onDelete?.(plan.id);
    onBack();
  };

  if (!generatedPlan) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-100 mb-2">Plan Generation Failed</h3>
        <p className="text-sm text-slate-400 mb-4 max-w-md mx-auto">
          {plan.processingError || "An unknown error occurred while generating your campaign plan."}
        </p>
        <div className="flex items-center justify-center gap-3">
          {onRetry && (
            <button
              onClick={() => onRetry(plan)}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-400 rounded-lg text-sm text-white transition flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
          )}
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition"
          >
            Back to Plans
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  const toggleCampaign = (index: number) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAdGroup = (campaignIndex: number, adGroupIndex: number) => {
    const key = `${campaignIndex}-${adGroupIndex}`;
    setExpandedAdGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">{plan.name}</h2>
          <p className="text-sm text-slate-400" title={formatFullDate(plan.createdAt)}>
            {formatDate(plan.createdAt)}
            {plan.industry && (
              <span className="ml-2 text-slate-500">
                | {INDUSTRY_BENCHMARKS[plan.industry]?.name || plan.industry}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onCreateAds && (
            <button
              onClick={() => onCreateAds(plan)}
              className="px-3 py-2 bg-gradient-to-r from-orange-500/20 to-pink-500/20 hover:from-orange-500/30 hover:to-pink-500/30 border border-orange-500/30 rounded-lg text-sm text-orange-300 transition flex items-center gap-2"
              title="Generate ad images from this plan"
            >
              <ImageIcon className="w-4 h-4" />
              Create Ads
            </button>
          )}
          {onChat && (
            <button
              onClick={() => onChat(plan)}
              className="px-3 py-2 bg-gradient-to-r from-violet-500/20 to-purple-500/20 hover:from-violet-500/30 hover:to-purple-500/30 border border-violet-500/30 rounded-lg text-sm text-violet-300 transition flex items-center gap-2"
              title="Ask AI about this plan"
            >
              <MessageCircle className="w-4 h-4" />
              Ask AI
            </button>
          )}
          <button className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-sm text-slate-300 transition flex items-center gap-2"
              title="Delete this plan"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={onBack}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition"
          >
            Back
          </button>
        </div>
      </div>

      {/* Summary */}
      {generatedPlan.summary && (
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-200 mb-4">Summary</h3>
        <p className="text-sm text-slate-400 mb-4">{generatedPlan.summary.productAnalysis}</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Unique Selling Points</h4>
            <ul className="space-y-1">
              {generatedPlan.summary.uniqueSellingPoints?.map((point, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Target Market</h4>
            <p className="text-xs text-slate-300">{generatedPlan.summary.targetMarket}</p>
          </div>
        </div>
      </div>
      )}

      {/* Budget Breakdown */}
      {generatedPlan.budgetBreakdown && (
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl p-5 border border-violet-500/20">
        <h3 className="text-sm font-medium text-slate-200 mb-4">Budget Recommendations</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Monthly Budget</p>
            <p className="text-lg font-semibold text-violet-400">
              ${generatedPlan.budgetBreakdown.recommendedMonthlyBudget?.toLocaleString() || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Est. CPC</p>
            <p className="text-lg font-semibold text-slate-200">
              ${generatedPlan.budgetBreakdown.estimatedCpc?.min?.toFixed(2) || '0.00'} - ${generatedPlan.budgetBreakdown.estimatedCpc?.max?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Est. Clicks/Month</p>
            <p className="text-lg font-semibold text-slate-200">
              {generatedPlan.budgetBreakdown.estimatedClicksPerMonth?.min?.toLocaleString() || 0} - {generatedPlan.budgetBreakdown.estimatedClicksPerMonth?.max?.toLocaleString() || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Est. Conversions</p>
            <p className="text-lg font-semibold text-emerald-400">
              {generatedPlan.budgetBreakdown.estimatedConversions?.min || 0} - {generatedPlan.budgetBreakdown.estimatedConversions?.max || 0}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Industry Benchmarks - v2 Enhancement */}
      {generatedPlan.industryBenchmarks && (
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-medium text-slate-200">
              Industry Benchmarks: {generatedPlan.industryBenchmarks.industry}
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">CPA Target</p>
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-medium text-slate-300">
                  ${generatedPlan.industryBenchmarks.expectedCpa?.target || 0}
                </p>
                <span className="text-xs text-slate-500">
                  (${generatedPlan.industryBenchmarks.expectedCpa?.low || 0}-${generatedPlan.industryBenchmarks.expectedCpa?.high || 0})
                </span>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Expected CTR</p>
              <p className="text-sm font-medium text-slate-300">
                {generatedPlan.industryBenchmarks.expectedCtr}%
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Expected CVR</p>
              <p className="text-sm font-medium text-slate-300">
                {generatedPlan.industryBenchmarks.expectedCvr}%
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Plan vs Benchmark</p>
              <p className={`text-sm font-medium ${
                generatedPlan.industryBenchmarks.planVsBenchmark === 'above average'
                  ? 'text-emerald-400'
                  : generatedPlan.industryBenchmarks.planVsBenchmark === 'below average'
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}>
                {generatedPlan.industryBenchmarks.planVsBenchmark}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Competitor Analysis - v2 Enhancement */}
      {generatedPlan.competitorAnalysis && (
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-medium text-slate-200">Competitor Analysis</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase mb-1">Their Value Proposition</p>
              <p className="text-sm text-slate-300">{generatedPlan.competitorAnalysis.valueProposition}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase mb-1">Target Audience</p>
              <p className="text-sm text-slate-300">{generatedPlan.competitorAnalysis.targetAudience}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase mb-2">Key Offers</p>
                <ul className="space-y-1">
                  {generatedPlan.competitorAnalysis.keyOffers?.map((offer, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-slate-600">•</span>
                      {offer}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase mb-2">Likely Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {generatedPlan.competitorAnalysis.likelyKeywords?.slice(0, 6).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-lg p-4 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 uppercase mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Differentiation Strategy
              </p>
              <p className="text-sm text-slate-200">{generatedPlan.competitorAnalysis.differentiationStrategy}</p>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-200">Campaign Structure</h3>

        {generatedPlan.campaigns?.map((campaign, campaignIndex) => (
          <div key={campaignIndex} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            {/* Campaign Header */}
            <button
              onClick={() => toggleCampaign(campaignIndex)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/80 transition"
            >
              <div className="flex items-center gap-3">
                {expandedCampaigns.has(campaignIndex) ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <div className="text-left">
                  <h4 className="text-sm font-medium text-slate-200">{campaign.campaignName}</h4>
                  <p className="text-xs text-slate-500">
                    {campaign.campaignType} | {campaign.biddingStrategy} | ${campaign.dailyBudget}/day
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500">{campaign.adGroups?.length || 0} ad groups</span>
            </button>

            {/* Ad Groups */}
            {expandedCampaigns.has(campaignIndex) && campaign.adGroups && (
              <div className="border-t border-slate-700/50">
                {campaign.adGroups.map((adGroup, adGroupIndex) => (
                  <div key={adGroupIndex} className="border-b border-slate-700/30 last:border-b-0">
                    {/* Ad Group Header */}
                    <button
                      onClick={() => toggleAdGroup(campaignIndex, adGroupIndex)}
                      className="w-full px-5 py-3 pl-10 flex items-center justify-between hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-2">
                        {expandedAdGroups.has(`${campaignIndex}-${adGroupIndex}`) ? (
                          <ChevronDown className="w-3 h-3 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-slate-500" />
                        )}
                        <span className="text-sm text-slate-300">{adGroup.name}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {adGroup.keywords?.keywords?.length || 0} keywords
                      </span>
                    </button>

                    {/* Ad Group Content */}
                    {expandedAdGroups.has(`${campaignIndex}-${adGroupIndex}`) && (
                      <div className="px-5 py-4 pl-14 bg-slate-900/30 space-y-4">
                        {/* Keywords */}
                        {adGroup.keywords?.keywords && adGroup.keywords.keywords.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-slate-400 uppercase mb-2">Keywords</h5>
                          <div className="space-y-1">
                            {adGroup.keywords.keywords.slice(0, 10).map((kw, kwIndex) => (
                              <div
                                key={kwIndex}
                                className="flex items-center justify-between py-1.5 px-2 bg-slate-800/50 rounded text-xs group"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300">{kw.keyword}</span>
                                  <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] text-slate-400">
                                    {kw.matchType}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-500">
                                  <span>Vol: {kw.estimatedVolume}</span>
                                  <span>CPC: {kw.estimatedCpc}</span>
                                  <button
                                    onClick={() => copyToClipboard(kw.keyword, `kw-${kwIndex}`)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition"
                                  >
                                    {copiedText === `kw-${kwIndex}` ? (
                                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                            {adGroup.keywords.keywords.length > 10 && (
                              <p className="text-xs text-slate-500 mt-2">
                                +{adGroup.keywords.keywords.length - 10} more keywords
                              </p>
                            )}
                          </div>
                        </div>
                        )}

                        {/* Ads */}
                        {adGroup.ads && adGroup.ads.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-slate-400 uppercase mb-2">Ad Copy</h5>
                          {adGroup.ads.map((ad, adIndex) => (
                            <div key={adIndex} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                              {ad.headlines && ad.headlines.length > 0 && (
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase mb-1">Headlines</p>
                                <div className="flex flex-wrap gap-1">
                                  {ad.headlines.map((headline, hIndex) => (
                                    <span
                                      key={hIndex}
                                      className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300 cursor-pointer hover:bg-blue-500/20 transition"
                                      onClick={() => copyToClipboard(headline, `h-${adIndex}-${hIndex}`)}
                                    >
                                      {copiedText === `h-${adIndex}-${hIndex}` ? "Copied!" : headline}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              )}
                              {ad.descriptions && ad.descriptions.length > 0 && (
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase mb-1">Descriptions</p>
                                <div className="space-y-1">
                                  {ad.descriptions.map((desc, dIndex) => (
                                    <p
                                      key={dIndex}
                                      className="text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition"
                                      onClick={() => copyToClipboard(desc, `d-${adIndex}-${dIndex}`)}
                                    >
                                      {copiedText === `d-${adIndex}-${dIndex}` ? "Copied!" : desc}
                                    </p>
                                  ))}
                                </div>
                              </div>
                              )}
                            </div>
                          ))}
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Next Steps */}
      {generatedPlan.nextSteps && generatedPlan.nextSteps.length > 0 && (
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-200 mb-3">Next Steps</h3>
        <ol className="space-y-2">
          {generatedPlan.nextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
              <span className="w-5 h-5 flex-shrink-0 rounded-full bg-violet-500/20 text-violet-400 text-xs flex items-center justify-center">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      )}

      {/* Implementation Guide - v2 Enhancement */}
      {generatedPlan.implementationGuide && generatedPlan.implementationGuide.length > 0 && (
        <ImplementationGuideSection
          guide={generatedPlan.implementationGuide}
          copyToClipboard={copyToClipboard}
          copiedText={copiedText}
        />
      )}
    </div>
  );
}

// Implementation Guide Section Component
function ImplementationGuideSection({
  guide,
  copyToClipboard,
  copiedText,
}: {
  guide: ImplementationStep[];
  copyToClipboard: (text: string, label: string) => void;
  copiedText: string | null;
}) {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]));

  const togglePhase = (phase: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  return (
    <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-5 border border-blue-500/20">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-medium text-slate-200">Implementation Guide</h3>
        <span className="text-xs text-slate-500 ml-auto">Step-by-step instructions to build this in Google Ads</span>
      </div>

      <div className="space-y-2">
        {guide.map((step) => (
          <div key={step.phase} className="bg-slate-900/50 rounded-lg overflow-hidden">
            {/* Phase Header */}
            <button
              onClick={() => togglePhase(step.phase)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition"
            >
              <div className="flex items-center gap-3">
                {expandedPhases.has(step.phase) ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-medium">
                  {step.phase}
                </span>
                <div className="text-left">
                  <h4 className="text-sm font-medium text-slate-200">{step.title}</h4>
                  <p className="text-xs text-slate-500">{step.description}</p>
                </div>
              </div>
            </button>

            {/* Phase Content */}
            {expandedPhases.has(step.phase) && (
              <div className="px-4 pb-4 pl-16 space-y-2">
                {step.substeps.map((substep, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 py-2 border-l-2 border-slate-700 pl-3"
                  >
                    <span className="text-xs text-slate-500 w-4">{idx + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm text-slate-300">{substep.action}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{substep.details}</p>
                      {substep.copyValue && (
                        <button
                          onClick={() => copyToClipboard(substep.copyValue!, `impl-${step.phase}-${idx}`)}
                          className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 flex items-center gap-2 transition group"
                        >
                          {copiedText === `impl-${step.phase}-${idx}` ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
                              <span className="font-mono text-blue-300 truncate max-w-[200px]">
                                {substep.copyValue}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PLANS LIST VIEW
// ============================================================================

// Helper function to format dates nicely
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function PlansListView({
  plans,
  loading,
  onSelectPlan,
  onNewPlan,
  onRefresh,
  onDeletePlan,
}: {
  plans: CampaignPlan[];
  loading: boolean;
  onSelectPlan: (plan: CampaignPlan) => void;
  onNewPlan: () => void;
  onRefresh: () => void;
  onDeletePlan: (planId: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this plan?")) return;

    setDeletingId(planId);
    await onDeletePlan(planId);
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Campaign Plans</h2>
          <p className="text-sm text-slate-400">Your saved campaign plans</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={onNewPlan}
            className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            New Plan
          </button>
        </div>
      </div>

      {/* Plans List */}
      {plans.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-slate-300 mb-2">No plans yet</h3>
          <p className="text-xs text-slate-500 mb-4">Create your first campaign plan to get started</p>
          <button
            onClick={onNewPlan}
            className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium rounded-lg"
          >
            Create Plan
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="w-full bg-slate-800/50 hover:bg-slate-800 rounded-xl p-4 border border-slate-700/50 hover:border-violet-500/30 transition flex items-center justify-between group"
            >
              <button
                onClick={() => onSelectPlan(plan)}
                className="flex-1 text-left"
              >
                <h4 className="text-sm font-medium text-slate-200">{plan.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5" title={formatFullDate(plan.createdAt)}>
                  {formatDate(plan.createdAt)}
                  {plan.industry && (
                    <span className="ml-2 text-slate-600">
                      | {INDUSTRY_BENCHMARKS[plan.industry]?.name || plan.industry}
                    </span>
                  )}
                </p>
              </button>
              <div className="flex items-center gap-2">
                {plan.status === "COMPLETED" && (
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded">
                    Completed
                  </span>
                )}
                {plan.status === "PROCESSING" && (
                  <span className="px-2 py-1 bg-violet-500/10 text-violet-400 text-xs rounded flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing
                  </span>
                )}
                {plan.status === "FAILED" && (
                  <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded">
                    Failed
                  </span>
                )}
                <button
                  onClick={(e) => handleDelete(e, plan.id)}
                  disabled={deletingId === plan.id}
                  className="p-1.5 hover:bg-red-500/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                  title="Delete plan"
                >
                  {deletingId === plan.id ? (
                    <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-400" />
                  )}
                </button>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CampaignPlannerView({
  onBack,
  onOpenChat,
  onCreateAds,
}: {
  onBack: () => void;
  onOpenChat?: (planName: string, context: string) => void;
  onCreateAds?: (campaignPlanId: string) => void;
}) {
  const [view, setView] = useState<"list" | "create" | "processing" | "display">("list");
  const [plans, setPlans] = useState<CampaignPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<CampaignPlan | null>(null);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, []);

  // Poll for processing plan status
  useEffect(() => {
    if (!processingPlanId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai/campaign-planner/${processingPlanId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.plan.status === "COMPLETED" || data.plan.status === "FAILED") {
            setSelectedPlan(data.plan);
            setProcessingPlanId(null);
            setView("display");
            fetchPlans(); // Refresh list
          }
        }
      } catch (error) {
        console.error("Error polling plan status:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [processingPlanId]);

  async function fetchPlans() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/campaign-planner/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
    setLoading(false);
  }

  async function handleDeletePlan(planId: string) {
    try {
      const res = await fetch(`/api/ai/campaign-planner/${planId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlans((prev) => prev.filter((p) => p.id !== planId));
        if (selectedPlan?.id === planId) {
          setSelectedPlan(null);
          setView("list");
        }
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete plan");
      }
    } catch (error) {
      console.error("Error deleting plan:", error);
      alert("Failed to delete plan");
    }
  }

  async function handleRetryPlan(plan: CampaignPlan) {
    // Create a new plan with the same inputs
    setCreating(true);
    try {
      const res = await fetch("/api/ai/campaign-planner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl: plan.productUrl,
          productDescription: plan.productDescription,
          targetAudience: plan.targetAudience,
          monthlyBudget: plan.monthlyBudget?.toString(),
          goals: plan.goals,
          name: plan.name + " (Retry)",
          competitorUrl: plan.competitorUrl,
          industry: plan.industry,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setProcessingPlanId(result.planId);
        setView("processing");
        // Optionally delete the failed plan
        await handleDeletePlan(plan.id);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to retry plan");
      }
    } catch (error) {
      console.error("Error retrying plan:", error);
      alert("Failed to retry plan");
    }
    setCreating(false);
  }

  function handleChatAboutPlan(plan: CampaignPlan) {
    if (!onOpenChat) {
      alert("AI Chat feature coming soon!");
      return;
    }

    const generatedPlan = plan.plan as GeneratedPlan | undefined;

    // Build rich context for the AI - explicitly tell it NOT to use account tools
    // and to just answer based on the plan details provided
    let context = `[GENERAL KNOWLEDGE QUESTION - DO NOT USE ANY TOOLS, just answer based on the information provided]

I have a Google Ads campaign plan called "${plan.name}"`;

    if (plan.industry) {
      context += ` for a ${INDUSTRY_BENCHMARKS[plan.industry]?.name || plan.industry} business`;
    }

    if (generatedPlan) {
      context += `.

PLAN DETAILS:
- Campaigns: ${generatedPlan.campaigns?.length || 0}
- Recommended Budget: $${generatedPlan.budgetBreakdown?.recommendedMonthlyBudget || 'N/A'}/month
- Est. CPC: $${generatedPlan.budgetBreakdown?.estimatedCpc?.min?.toFixed(2) || '?'} - $${generatedPlan.budgetBreakdown?.estimatedCpc?.max?.toFixed(2) || '?'}`;

      if (generatedPlan.summary?.productAnalysis) {
        context += `
- Product: ${generatedPlan.summary.productAnalysis.slice(0, 300)}`;
      }

      if (generatedPlan.summary?.uniqueSellingPoints?.length) {
        context += `
- USPs: ${generatedPlan.summary.uniqueSellingPoints.slice(0, 3).join('; ')}`;
      }

      if (generatedPlan.industryBenchmarks) {
        context += `
- Industry: ${generatedPlan.industryBenchmarks.industry}
- Expected CPA: $${generatedPlan.industryBenchmarks.expectedCpa?.target || '?'}`;
      }
    }

    context += `

Help me understand this plan, suggest optimizations, or answer questions about implementing it in Google Ads. Be specific and actionable.`;

    onOpenChat(plan.name, context);
  }

  async function handleCreatePlan(data: {
    productUrl?: string;
    productDescription?: string;
    targetAudience?: string;
    monthlyBudget?: string;
    goals?: string;
    name?: string;
    competitorUrl?: string;
    industry?: string;
  }) {
    setCreating(true);
    try {
      const res = await fetch("/api/ai/campaign-planner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        setProcessingPlanId(result.planId);
        setView("processing");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create plan");
      }
    } catch (error) {
      console.error("Error creating plan:", error);
      alert("Failed to create plan");
    }
    setCreating(false);
  }

  async function handleSelectPlan(plan: CampaignPlan) {
    if (plan.status === "PROCESSING") {
      setProcessingPlanId(plan.id);
      setView("processing");
    } else {
      // Fetch full plan details (list view doesn't include the plan JSON)
      try {
        const res = await fetch(`/api/ai/campaign-planner/${plan.id}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedPlan(data.plan);
          setView("display");
        } else {
          alert("Failed to load plan details");
        }
      } catch (error) {
        console.error("Error fetching plan:", error);
        alert("Failed to load plan details");
      }
    }
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tools
      </button>

      {view === "list" && (
        <PlansListView
          plans={plans}
          loading={loading}
          onSelectPlan={handleSelectPlan}
          onNewPlan={() => setView("create")}
          onRefresh={fetchPlans}
          onDeletePlan={handleDeletePlan}
        />
      )}

      {view === "create" && (
        <InputStep onSubmit={handleCreatePlan} isLoading={creating} />
      )}

      {view === "processing" && processingPlanId && (
        <ProcessingStep planId={processingPlanId} />
      )}

      {view === "display" && selectedPlan && (
        <PlanDisplay
          plan={selectedPlan}
          onBack={() => setView("list")}
          onDelete={handleDeletePlan}
          onRetry={handleRetryPlan}
          onChat={handleChatAboutPlan}
          onCreateAds={onCreateAds ? (plan) => onCreateAds(plan.id) : undefined}
        />
      )}
    </div>
  );
}
