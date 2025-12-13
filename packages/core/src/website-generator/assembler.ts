/**
 * Website Assembler
 *
 * Takes presets + AI-generated content and assembles a complete website ZIP.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require("jszip");
import {
  ColorTheme,
  LayoutPreset,
  FontPairing,
  AnimationPreset,
  LogoIcon,
  NicheType,
  selectRandomPresets,
} from "./presets";

// ============================================================================
// Types
// ============================================================================

export interface GeneratedContent {
  siteName: string;
  tagline: string;
  metaDescription: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroCtaText: string;
  featuresTitle: string;
  feature1Title: string;
  feature1Description: string;
  feature2Title: string;
  feature2Description: string;
  feature3Title: string;
  feature3Description: string;
  aboutTitle: string;
  aboutDescription: string;
  footerTagline: string;
  // Social casino specific
  gameName?: string;
  gameTagline?: string;
}

export interface GeneratedImages {
  hero: Buffer | Uint8Array;
  feature1: Buffer | Uint8Array;
  feature2: Buffer | Uint8Array;
}

export interface SelectedPresets {
  colors: ColorTheme;
  layout: LayoutPreset;
  fonts: FontPairing;
  animation: AnimationPreset;
  logoIcon: LogoIcon;
}

export interface AssembleOptions {
  niche: NicheType;
  domain: string;
  content: GeneratedContent;
  images: GeneratedImages;
  presets?: SelectedPresets;
}

// ============================================================================
// Template Loading
// ============================================================================

// Templates are embedded at build time
// These are the raw template strings that get compiled into the bundle

const BASE_TEMPLATES = {
  "index.html": `{{INDEX_TEMPLATE}}`,
  "terms.html": `{{TERMS_TEMPLATE}}`,
  "privacy.html": `{{PRIVACY_TEMPLATE}}`,
  "css/style.css": `{{STYLE_TEMPLATE}}`,
};

const SOCIAL_CASINO_TEMPLATES = {
  "play.html": `{{PLAY_TEMPLATE}}`,
  "css/slots.css": `{{SLOTS_CSS_TEMPLATE}}`,
  "js/slots.js": `{{SLOTS_JS_TEMPLATE}}`,
};

// ============================================================================
// Variable Replacement
// ============================================================================

function buildVariables(
  options: AssembleOptions,
  presets: SelectedPresets
): Record<string, string> {
  const { niche, domain, content } = options;
  const { colors, layout, fonts, animation, logoIcon } = presets;

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentYear = new Date().getFullYear().toString();

  // Base variables
  const variables: Record<string, string> = {
    // Site info
    SITE_NAME: content.siteName,
    TAGLINE: content.tagline,
    META_DESCRIPTION: content.metaDescription,
    CURRENT_DATE: currentDate,
    CURRENT_YEAR: currentYear,

    // Colors
    COLOR_PRIMARY: colors.primary,
    COLOR_SECONDARY: colors.secondary,
    COLOR_ACCENT: colors.accent,
    COLOR_BACKGROUND: colors.background,
    COLOR_SURFACE: colors.surface,
    COLOR_TEXT: colors.text,
    COLOR_TEXT_MUTED: colors.textMuted,

    // Fonts
    FONT_HEADING: fonts.heading,
    FONT_BODY: fonts.body,
    GOOGLE_FONTS_URL: fonts.googleFontsUrl,

    // Layout
    LAYOUT_STYLE: layout.heroStyle,

    // Animations
    ANIMATION_FADE_IN: animation.fadeIn,
    ANIMATION_HOVER: animation.hover,
    BUTTON_HOVER_STYLE: animation.buttonHover,

    // Logo
    LOGO_ICON: logoIcon.svg,
    FAVICON_SVG: encodeURIComponent(
      logoIcon.svg.replace("currentColor", colors.primary)
    ),

    // Hero content
    HERO_HEADLINE: content.heroHeadline,
    HERO_SUBHEADLINE: content.heroSubheadline,
    HERO_IMAGE_ALT: `${content.siteName} - ${content.tagline}`,

    // Features content
    FEATURES_TITLE: content.featuresTitle,
    FEATURE_1_TITLE: content.feature1Title,
    FEATURE_1_DESCRIPTION: content.feature1Description,
    FEATURE_2_TITLE: content.feature2Title,
    FEATURE_2_DESCRIPTION: content.feature2Description,
    FEATURE_3_TITLE: content.feature3Title,
    FEATURE_3_DESCRIPTION: content.feature3Description,
    FEATURE_3_ICON: logoIcon.svg,

    // About content
    ABOUT_TITLE: content.aboutTitle,
    ABOUT_DESCRIPTION: content.aboutDescription,

    // Footer
    FOOTER_TAGLINE: content.footerTagline,
  };

  // Niche-specific variables
  if (niche === "social-casino") {
    // Play link in navigation
    variables.NAV_PLAY_LINK = '<a href="play.html">Play Now</a>';

    // Hero CTA button
    variables.HERO_CTA_BUTTON = `
      <a href="play.html" class="btn btn-primary btn-large">Play Free Now</a>
      <a href="#features" class="btn btn-secondary">Learn More</a>
    `;

    // Hero disclaimer
    variables.HERO_DISCLAIMER = `
      <p class="hero-disclaimer">Free to play. No real money gambling. 18+ only.</p>
    `;

    // Age verification modal
    variables.AGE_VERIFICATION_MODAL = `
      <div id="age-modal" class="age-modal">
        <div class="age-modal-content">
          <h2>Age Verification Required</h2>
          <p>You must be 18 years or older to access this site.</p>
          <div class="age-warning">
            <p>This is a social gaming site. No real money gambling. For entertainment purposes only.</p>
          </div>
          <div class="age-buttons">
            <button onclick="verifyAge()" class="btn btn-primary btn-large">I am 18 or older</button>
            <button onclick="denyAge()" class="btn btn-secondary">I am under 18</button>
          </div>
        </div>
      </div>
    `;

    // Age verification script
    variables.AGE_VERIFICATION_SCRIPT = `
      function verifyAge() {
        localStorage.setItem('ageVerified', 'true');
        document.getElementById('age-modal').style.display = 'none';
      }

      function denyAge() {
        window.location.href = 'https://www.google.com';
      }

      if (localStorage.getItem('ageVerified') !== 'true') {
        document.getElementById('age-modal').style.display = 'flex';
      } else {
        document.getElementById('age-modal').style.display = 'none';
      }
    `;

    // About CTA
    variables.ABOUT_CTA = `
      <a href="play.html" class="btn btn-primary">Start Playing</a>
    `;

    // Footer extra links
    variables.FOOTER_EXTRA_LINKS = `
      <div class="footer-links">
        <h4>Play</h4>
        <a href="play.html">Free Slots</a>
      </div>
    `;

    // Responsible gaming footer
    variables.RESPONSIBLE_GAMING_FOOTER = `
      <div class="responsible-gaming">
        <h4>Responsible Gaming</h4>
        <p>This is a free-to-play social gaming site. No real money gambling. Virtual credits have no cash value and cannot be redeemed for real money or prizes. If you or someone you know has a gambling problem, please seek help.</p>
      </div>
    `;

    // No real money disclaimer
    variables.NO_REAL_MONEY_DISCLAIMER = `
      <div class="no-real-money">
        <p>NO REAL MONEY - FOR ENTERTAINMENT PURPOSES ONLY</p>
      </div>
    `;

    // Terms service description
    variables.TERMS_SERVICE_DESCRIPTION = `${content.siteName} provides a free-to-play social gaming platform for entertainment purposes only. Our Service includes virtual slot machine games that use virtual credits with no real-world value.`;

    // Terms no gambling clause
    variables.TERMS_NO_GAMBLING_CLAUSE = `
      <p><strong>IMPORTANT:</strong> This is NOT a gambling site. No real money is wagered or won. Virtual credits cannot be exchanged for real money, goods, or services. All gameplay is purely for entertainment.</p>
    `;

    // Terms virtual currency section
    variables.TERMS_VIRTUAL_CURRENCY = `
      <p>Our Service may include virtual credits or currency ("Virtual Items"). These Virtual Items:</p>
      <ul>
        <li>Have no real-world monetary value</li>
        <li>Cannot be sold, traded, or exchanged for real money</li>
        <li>Cannot be redeemed for any goods or services</li>
        <li>Are provided solely for entertainment purposes</li>
        <li>May be modified or removed at any time without notice</li>
      </ul>
    `;

    // Terms prohibited gambling
    variables.TERMS_PROHIBITED_GAMBLING = `
      <li>Use the Service for real-money gambling purposes</li>
      <li>Attempt to convert virtual credits to real currency</li>
    `;

    // Game-specific content
    variables.GAME_NAME = content.gameName || `${content.siteName} Slots`;
    variables.GAME_TAGLINE = content.gameTagline || "Spin to win virtual credits!";
  } else {
    // Default values for non-casino sites
    variables.NAV_PLAY_LINK = "";
    variables.HERO_CTA_BUTTON = `
      <a href="#features" class="btn btn-primary btn-large">${content.heroCtaText || "Get Started"}</a>
    `;
    variables.HERO_DISCLAIMER = "";
    variables.AGE_VERIFICATION_MODAL = "";
    variables.AGE_VERIFICATION_SCRIPT = "";
    variables.ABOUT_CTA = "";
    variables.FOOTER_EXTRA_LINKS = "";
    variables.RESPONSIBLE_GAMING_FOOTER = "";
    variables.NO_REAL_MONEY_DISCLAIMER = "";
    variables.TERMS_SERVICE_DESCRIPTION = `${content.siteName} provides online services and content through our website and related platforms.`;
    variables.TERMS_NO_GAMBLING_CLAUSE = "";
    variables.TERMS_VIRTUAL_CURRENCY = `<p>Any virtual items or credits on our platform are for use within our Service only and have no monetary value outside of the Service.</p>`;
    variables.TERMS_PROHIBITED_GAMBLING = "";
  }

  return variables;
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value);
  }

  return result;
}

// ============================================================================
// Main Assembly Function
// ============================================================================

export async function assembleWebsite(options: AssembleOptions): Promise<Buffer> {
  const { niche, images } = options;

  // Use provided presets or generate random ones
  const presets = options.presets || selectRandomPresets();

  // Build variable map
  const variables = buildVariables(options, presets);

  // Create ZIP archive
  const zip = new JSZip();

  // Add base templates
  for (const [filename, templateContent] of Object.entries(BASE_TEMPLATES)) {
    // For embedded templates, we need to load them from the actual files
    // This is a placeholder - actual implementation will load from filesystem or embed
    const content = replaceVariables(templateContent, variables);
    zip.file(filename, content);
  }

  // Add niche-specific templates
  if (niche === "social-casino") {
    for (const [filename, templateContent] of Object.entries(SOCIAL_CASINO_TEMPLATES)) {
      const content = replaceVariables(templateContent, variables);
      zip.file(filename, content);
    }
  }

  // Add images
  zip.file("images/hero.png", images.hero);
  zip.file("images/feature1.png", images.feature1);
  zip.file("images/feature2.png", images.feature2);

  // Generate ZIP buffer
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return zipBuffer;
}

// ============================================================================
// Template Loading from Filesystem
// ============================================================================

import * as fs from "fs";
import * as path from "path";

const TEMPLATES_DIR = path.join(__dirname, "templates");

export function loadTemplate(templatePath: string): string {
  const fullPath = path.join(TEMPLATES_DIR, templatePath);
  return fs.readFileSync(fullPath, "utf-8");
}

export async function assembleWebsiteFromFiles(options: AssembleOptions): Promise<Buffer> {
  const { niche, images } = options;

  // Use provided presets or generate random ones
  const presets = options.presets || selectRandomPresets();

  // Build variable map
  const variables = buildVariables(options, presets);

  // Create ZIP archive
  const zip = new JSZip();

  // Load and process base templates
  const baseFiles = [
    "base/index.html",
    "base/terms.html",
    "base/privacy.html",
    "base/css/style.css",
  ];

  for (const templatePath of baseFiles) {
    const template = loadTemplate(templatePath);
    const processed = replaceVariables(template, variables);
    // Remove 'base/' prefix for output
    const outputPath = templatePath.replace("base/", "");
    zip.file(outputPath, processed);
  }

  // Load and process niche-specific templates
  if (niche === "social-casino") {
    const nicheFiles = [
      { src: "niches/social-casino/play.html", dest: "play.html" },
      { src: "niches/social-casino/css/slots.css", dest: "css/slots.css" },
      { src: "niches/social-casino/js/slots.js", dest: "js/slots.js" },
    ];

    for (const { src, dest } of nicheFiles) {
      const template = loadTemplate(src);
      const processed = replaceVariables(template, variables);
      zip.file(dest, processed);
    }
  }

  // Add images
  zip.file("images/hero.png", images.hero);
  zip.file("images/feature1.png", images.feature1);
  zip.file("images/feature2.png", images.feature2);

  // Generate ZIP buffer
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return zipBuffer;
}

// ============================================================================
// Preset Info for Response
// ============================================================================

export function getPresetInfo(presets: SelectedPresets): Record<string, string> {
  return {
    colorTheme: presets.colors.name,
    layout: presets.layout.name,
    fontPairing: presets.fonts.name,
    animation: presets.animation.name,
    logoIcon: presets.logoIcon.name,
  };
}
