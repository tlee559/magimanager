export interface Ad {
  position: number;
  block_position?: string;
  title: string;
  description?: string;
  displayed_link?: string;
  link: string;
  tracking_link?: string;
  source?: string;
  sitelinks?: Sitelink[];
  extensions?: string[];
  thumbnail?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
  landing_page_screenshot_url?: string;
  screenshot_error?: string;
}

export interface Sitelink {
  title: string;
  link: string;
  snippet?: string;
}

export interface AIAnalysis {
  marketOverview: string;
  competitorInsights: CompetitorInsight[];
  winningPatterns: {
    headlines: string[];
    descriptions: string[];
    extensions: string[];
  };
  recommendations: {
    headlines: string[];
    descriptions: string[];
    sitelinks: string[];
    extensions: string[];
  };
  differentiationOpportunities: string[];
  _parseError?: boolean;
}

export interface CompetitorInsight {
  advertiser: string;
  strengths: string[];
  weaknesses: string[];
  copyTactics: string[];
}

export interface AdSpyJob {
  id: string;
  keyword: string;
  location: string;
  businessContext?: string;
  status: "pending" | "searching" | "screenshotting" | "analyzing" | "completed" | "failed";
  progress: number;
  ads?: Ad[];
  aiAnalysis?: AIAnalysis;
  screenshotUrls?: Record<number, string>;
  error?: string;
  debug?: string[];
  createdAt: string;
  updatedAt: string;
}

export const LOCATIONS = [
  { code: "us", name: "United States" },
  { code: "uk", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
  { code: "in", name: "India" },
  { code: "jp", name: "Japan" },
] as const;
