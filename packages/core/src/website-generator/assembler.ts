/**
 * Website Assembler
 *
 * Takes presets + AI-generated content and assembles a complete website ZIP.
 * Templates are embedded directly for serverless compatibility.
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
  FeatureLayout,
  ButtonStyle,
  CardStyle,
  TypographyStyle,
  HeroBackground,
  HoverEffect,
  selectRandomPresets,
  selectOptionalSections,
  selectSymbolSet,
  NAV_LAYOUTS,
  FOOTER_LAYOUTS,
  NavLayout,
  FooterLayout,
  ThemedSymbolSet,
} from "./presets";
import {
  INDEX_TEMPLATE,
  TERMS_TEMPLATE,
  PRIVACY_TEMPLATE,
  STYLE_TEMPLATE,
  PLAY_TEMPLATE,
  SLOTS_CSS_TEMPLATE,
  SLOTS_JS_TEMPLATE,
} from "./templates";
import { NP_FILES } from "./np-files";
// Import files that add to NP_FILES
import "./np-files-large";
import "./np-files-go";

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
  // Dynamic features (feature1-5)
  feature1Title?: string;
  feature1Description?: string;
  feature2Title?: string;
  feature2Description?: string;
  feature3Title?: string;
  feature3Description?: string;
  feature4Title?: string;
  feature4Description?: string;
  feature5Title?: string;
  feature5Description?: string;
  aboutTitle: string;
  aboutDescription: string;
  footerTagline: string;
  // Social casino specific
  gameName?: string;
  gameTagline?: string;
  // Allow dynamic access
  [key: string]: string | undefined;
}

export interface GeneratedImages {
  hero: Buffer | Uint8Array;
  features: (Buffer | Uint8Array)[];
}

export interface SelectedPresets {
  colors: ColorTheme;
  layout: LayoutPreset;
  fonts: FontPairing;
  animation: AnimationPreset;
  logoIcon: LogoIcon;
  featureLayout: FeatureLayout;
  buttonStyle: ButtonStyle;
  cardStyle: CardStyle;
  typography: TypographyStyle;
  heroBackground: HeroBackground;
  hoverEffect: HoverEffect;
}

export interface AssembleOptions {
  niche: NicheType;
  domain: string;
  content: GeneratedContent;
  images: GeneratedImages;
  presets?: SelectedPresets;
  featureCount?: number; // 2-5 features
}

// ============================================================================
// Variable Replacement
// ============================================================================

// Helper to convert hex to RGB values
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  }
  return "0, 0, 0";
}

// Generate a gradient logo SVG with the first letter of the site name
function generateLogoSvg(siteName: string, primaryColor: string, secondaryColor: string): string {
  const letter = siteName.charAt(0).toUpperCase();
  // Create a unique gradient ID based on colors to avoid conflicts
  const gradientId = `logo-grad-${primaryColor.replace('#', '')}-${secondaryColor.replace('#', '')}`;

  return `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${primaryColor}"/>
        <stop offset="100%" style="stop-color:${secondaryColor}"/>
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="8" fill="url(#${gradientId})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22">${letter}</text>
  </svg>`;
}

// Generate a favicon SVG (same as logo but optimized for small sizes)
function generateFaviconSvg(siteName: string, primaryColor: string, secondaryColor: string): string {
  const letter = siteName.charAt(0).toUpperCase();
  const gradientId = `fav-grad-${primaryColor.replace('#', '')}-${secondaryColor.replace('#', '')}`;

  return `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${primaryColor}"/>
        <stop offset="100%" style="stop-color:${secondaryColor}"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="6" fill="url(#${gradientId})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18">${letter}</text>
  </svg>`;
}

// Generate feature cards HTML dynamically
// Split features into two sections: first half with images, second half with icons
function generateFeatureCardsHtml(
  content: GeneratedContent,
  featureCount: number,
  cardStyleClass: string,
  logoIconSvg: string,
  featureGridClass: string
): string {
  // Split features: first section gets images, second section gets icons
  const imageFeatureCount = Math.ceil(featureCount / 2);

  const imageCards: string[] = [];
  const iconCards: string[] = [];

  // First section: features with images
  for (let i = 1; i <= imageFeatureCount; i++) {
    const title = content[`feature${i}Title`] || `Feature ${i}`;
    const description = content[`feature${i}Description`] || "";

    imageCards.push(`
        <div class="feature-card ${cardStyleClass} animate-on-scroll" style="--card-index: ${i - 1};">
          <div class="feature-image">
            <img src="images/feature${i}.png" alt="${title}">
          </div>
          <div class="feature-content">
            <h3>${title}</h3>
            <p>${description}</p>
          </div>
        </div>
    `);
  }

  // Second section: features with icons
  for (let i = imageFeatureCount + 1; i <= featureCount; i++) {
    const title = content[`feature${i}Title`] || `Feature ${i}`;
    const description = content[`feature${i}Description`] || "";

    iconCards.push(`
        <div class="feature-card ${cardStyleClass} animate-on-scroll" style="--card-index: ${i - imageFeatureCount - 1};">
          <div class="feature-icon">${logoIconSvg}</div>
          <div class="feature-content">
            <h3>${title}</h3>
            <p>${description}</p>
          </div>
        </div>
    `);
  }

  // Combine into two sections with the selected grid layout
  let html = '';

  // First section with images
  if (imageCards.length > 0) {
    html += `
      <div class="features-grid ${featureGridClass} features-with-images">
        ${imageCards.join("\n")}
      </div>
    `;
  }

  // Second section with icons (if there are any)
  if (iconCards.length > 0) {
    html += `
      <div class="features-grid ${featureGridClass} features-with-icons">
        ${iconCards.join("\n")}
      </div>
    `;
  }

  return html;
}

// Generate optional sections HTML
function generateOptionalSectionsHtml(
  sections: string[],
  siteName: string,
  niche: NicheType,
  cardStyleClass: string
): string {
  const html: string[] = [];

  for (const sectionId of sections) {
    switch (sectionId) {
      case "stats":
        html.push(`
  <!-- Stats Section -->
  <section class="stats-section">
    <div class="container">
      <div class="stats-grid">
        <div class="stat-item animate-on-scroll">
          <span class="stat-number" data-target="50000">50K+</span>
          <span class="stat-label">Happy Players</span>
        </div>
        <div class="stat-item animate-on-scroll">
          <span class="stat-number" data-target="1000000">1M+</span>
          <span class="stat-label">Games Played</span>
        </div>
        <div class="stat-item animate-on-scroll">
          <span class="stat-number" data-target="500">500+</span>
          <span class="stat-label">Daily Winners</span>
        </div>
        <div class="stat-item animate-on-scroll">
          <span class="stat-number">24/7</span>
          <span class="stat-label">Free Entertainment</span>
        </div>
      </div>
    </div>
  </section>
        `);
        break;

      case "testimonials":
        html.push(`
  <!-- Testimonials Section -->
  <section class="testimonials-section">
    <div class="container">
      <h2 class="section-title">What Players Say</h2>
      <div class="testimonials-grid">
        <div class="testimonial-card ${cardStyleClass} animate-on-scroll">
          <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
          <p class="testimonial-text">"Best free casino experience! I love playing during my breaks. The graphics are amazing!"</p>
          <div class="testimonial-author">
            <span class="author-name">Alex M.</span>
            <span class="author-title">Daily Player</span>
          </div>
        </div>
        <div class="testimonial-card ${cardStyleClass} animate-on-scroll">
          <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
          <p class="testimonial-text">"Finally a site that's actually free! No hidden costs, just pure fun. Highly recommend."</p>
          <div class="testimonial-author">
            <span class="author-name">Sarah K.</span>
            <span class="author-title">Weekend Spinner</span>
          </div>
        </div>
        <div class="testimonial-card ${cardStyleClass} animate-on-scroll">
          <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
          <p class="testimonial-text">"The slot games are so smooth and exciting. Love the daily bonuses!"</p>
          <div class="testimonial-author">
            <span class="author-name">Mike R.</span>
            <span class="author-title">VIP Member</span>
          </div>
        </div>
      </div>
    </div>
  </section>
        `);
        break;

      case "faq":
        html.push(`
  <!-- FAQ Section -->
  <section class="faq-section">
    <div class="container">
      <h2 class="section-title">Frequently Asked Questions</h2>
      <div class="faq-list">
        <div class="faq-item ${cardStyleClass} animate-on-scroll">
          <div class="faq-question" onclick="this.parentElement.classList.toggle('active')">
            <span>Is this really free to play?</span>
            <span class="faq-icon">+</span>
          </div>
          <div class="faq-answer">
            <p>Yes! ${siteName} is 100% free to play. We provide virtual credits for entertainment purposes only. No real money is ever required or involved.</p>
          </div>
        </div>
        <div class="faq-item ${cardStyleClass} animate-on-scroll">
          <div class="faq-question" onclick="this.parentElement.classList.toggle('active')">
            <span>Can I win real money?</span>
            <span class="faq-icon">+</span>
          </div>
          <div class="faq-answer">
            <p>No, this is a social gaming platform for entertainment only. All winnings are virtual credits with no cash value. You cannot exchange credits for real money.</p>
          </div>
        </div>
        <div class="faq-item ${cardStyleClass} animate-on-scroll">
          <div class="faq-question" onclick="this.parentElement.classList.toggle('active')">
            <span>What happens if I run out of credits?</span>
            <span class="faq-icon">+</span>
          </div>
          <div class="faq-answer">
            <p>Don't worry! Your credits automatically refill so you can keep playing. The fun never stops!</p>
          </div>
        </div>
        <div class="faq-item ${cardStyleClass} animate-on-scroll">
          <div class="faq-question" onclick="this.parentElement.classList.toggle('active')">
            <span>Is there an age requirement?</span>
            <span class="faq-icon">+</span>
          </div>
          <div class="faq-answer">
            <p>Yes, you must be 18 years or older to use ${siteName}. This ensures responsible gaming for all our players.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
        `);
        break;

      case "cta-banner":
        if (niche === "social-casino") {
          html.push(`
  <!-- CTA Banner Section -->
  <section class="cta-banner-section">
    <div class="container">
      <div class="cta-banner ${cardStyleClass}">
        <div class="cta-content">
          <h2>Ready to Start Winning?</h2>
          <p>Join thousands of players enjoying free casino games. No download required!</p>
        </div>
        <div class="cta-action">
          <a href="play.html" class="btn btn-primary btn-large">Play Free Now</a>
        </div>
      </div>
    </div>
  </section>
          `);
        }
        break;
    }
  }

  return html.join("\n");
}

// Generate navigation HTML based on layout
function generateNavHtml(navLayout: NavLayout, siteName: string, logoIcon: string, niche: NicheType): string {
  const playLink = niche === "social-casino" ? '<a href="play.html">Play Now</a>' : '';

  switch (navLayout.style) {
    case "centered":
      return `
  <nav class="navbar navbar-centered">
    <div class="container">
      <div class="nav-links nav-left">
        <a href="index.html" class="active">Home</a>
        ${playLink}
      </div>
      <a href="index.html" class="logo">
        <span class="logo-icon">${logoIcon}</span>
        <span class="logo-text">${siteName}</span>
      </a>
      <div class="nav-links nav-right">
        <a href="terms.html">Terms</a>
        <a href="privacy.html">Privacy</a>
      </div>
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>`;

    case "minimal":
      return `
  <nav class="navbar navbar-minimal">
    <div class="container">
      <a href="index.html" class="logo">
        <span class="logo-icon">${logoIcon}</span>
      </a>
      <div class="nav-links">
        ${playLink}
      </div>
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>`;

    case "split":
      return `
  <nav class="navbar navbar-split">
    <div class="container">
      <a href="index.html" class="logo">
        <span class="logo-icon">${logoIcon}</span>
        <span class="logo-text">${siteName}</span>
      </a>
      <div class="nav-center">
        <a href="index.html" class="active">Home</a>
        ${playLink}
        <a href="terms.html">Terms</a>
        <a href="privacy.html">Privacy</a>
      </div>
      <div class="nav-cta">
        ${niche === "social-casino" ? '<a href="play.html" class="btn btn-primary">Play Free</a>' : ''}
      </div>
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>`;

    default: // standard
      return `
  <nav class="navbar">
    <div class="container">
      <a href="index.html" class="logo">
        <span class="logo-icon">${logoIcon}</span>
        <span class="logo-text">${siteName}</span>
      </a>
      <div class="nav-links">
        <a href="index.html" class="active">Home</a>
        ${playLink}
        <a href="terms.html">Terms</a>
        <a href="privacy.html">Privacy</a>
      </div>
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>`;
  }
}

// Generate footer HTML based on layout
function generateFooterHtml(
  footerLayout: FooterLayout,
  siteName: string,
  logoIcon: string,
  footerTagline: string,
  niche: NicheType,
  currentYear: string
): string {
  const responsibleGaming = niche === "social-casino" ? `
    <div class="responsible-gaming">
      <h4>Responsible Gaming</h4>
      <p>This is a free-to-play social gaming site. No real money gambling. Virtual credits have no cash value.</p>
    </div>` : '';

  const noRealMoney = niche === "social-casino" ? `
    <div class="no-real-money">
      <p>NO REAL MONEY - FOR ENTERTAINMENT PURPOSES ONLY</p>
    </div>` : '';

  switch (footerLayout.style) {
    case "centered":
      return `
  <footer class="footer footer-centered">
    <div class="container">
      <a href="index.html" class="logo">
        <span class="logo-icon">${logoIcon}</span>
        <span class="logo-text">${siteName}</span>
      </a>
      <p class="footer-tagline">${footerTagline}</p>
      <div class="footer-links-inline">
        <a href="terms.html">Terms</a>
        <span class="separator">•</span>
        <a href="privacy.html">Privacy</a>
      </div>
      ${responsibleGaming}
      <div class="footer-bottom">
        <p>&copy; ${currentYear} ${siteName}. All rights reserved.</p>
        ${noRealMoney}
      </div>
    </div>
  </footer>`;

    case "minimal":
      return `
  <footer class="footer footer-minimal">
    <div class="container">
      <div class="footer-row">
        <p>&copy; ${currentYear} ${siteName}</p>
        <div class="footer-links-inline">
          <a href="terms.html">Terms</a>
          <a href="privacy.html">Privacy</a>
        </div>
      </div>
      ${noRealMoney}
    </div>
  </footer>`;

    case "columns":
      return `
  <footer class="footer footer-columns">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <a href="index.html" class="logo">
            <span class="logo-icon">${logoIcon}</span>
            <span class="logo-text">${siteName}</span>
          </a>
          <p class="footer-tagline">${footerTagline}</p>
        </div>
        <div class="footer-col">
          <h4>Quick Links</h4>
          <a href="index.html">Home</a>
          ${niche === "social-casino" ? '<a href="play.html">Play Now</a>' : ''}
        </div>
        <div class="footer-col">
          <h4>Legal</h4>
          <a href="terms.html">Terms of Service</a>
          <a href="privacy.html">Privacy Policy</a>
        </div>
        <div class="footer-col">
          <h4>Support</h4>
          <p class="footer-contact">Contact us for any questions.</p>
        </div>
      </div>
      ${responsibleGaming}
      <div class="footer-bottom">
        <p>&copy; ${currentYear} ${siteName}. All rights reserved.</p>
        ${noRealMoney}
      </div>
    </div>
  </footer>`;

    default: // standard
      return `
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-brand">
          <a href="index.html" class="logo">
            <span class="logo-icon">${logoIcon}</span>
            <span class="logo-text">${siteName}</span>
          </a>
          <p class="footer-tagline">${footerTagline}</p>
        </div>
        <div class="footer-links">
          <h4>Legal</h4>
          <a href="terms.html">Terms of Service</a>
          <a href="privacy.html">Privacy Policy</a>
        </div>
        ${niche === "social-casino" ? `
        <div class="footer-links">
          <h4>Play</h4>
          <a href="play.html">Free Slots</a>
        </div>` : ''}
      </div>
      ${responsibleGaming}
      <div class="footer-bottom">
        <p>&copy; ${currentYear} ${siteName}. All rights reserved.</p>
        ${noRealMoney}
      </div>
    </div>
  </footer>`;
  }
}

function buildVariables(
  options: AssembleOptions,
  presets: SelectedPresets,
  featureCount: number,
  optionalSections: string[],
  navLayout: NavLayout,
  footerLayout: FooterLayout,
  symbolSet: ThemedSymbolSet,
  classPrefix: string
): Record<string, string> {
  const { niche, content, domain } = options;
  const { colors, layout, fonts, animation, featureLayout, buttonStyle, cardStyle, typography, heroBackground, hoverEffect } = presets;

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentYear = new Date().getFullYear().toString();

  // Get user description for theme-aware features
  const description = domain || "";

  // Generate dynamic logo based on site name and theme colors
  const logoSvg = generateLogoSvg(content.siteName, colors.primary, colors.secondary);
  const faviconSvg = generateFaviconSvg(content.siteName, colors.primary, colors.secondary);

  // Base variables
  const variables: Record<string, string> = {
    // Site info
    SITE_NAME: content.siteName,
    TAGLINE: content.tagline,
    META_DESCRIPTION: content.metaDescription,
    CURRENT_DATE: currentDate,
    CURRENT_YEAR: currentYear,

    // Colors (with RGB variants for rgba usage)
    COLOR_PRIMARY: colors.primary,
    COLOR_PRIMARY_RGB: hexToRgb(colors.primary),
    COLOR_SECONDARY: colors.secondary,
    COLOR_SECONDARY_RGB: hexToRgb(colors.secondary),
    COLOR_ACCENT: colors.accent,
    COLOR_ACCENT_RGB: hexToRgb(colors.accent),
    COLOR_BACKGROUND: colors.background,
    COLOR_BACKGROUND_RGB: hexToRgb(colors.background),
    COLOR_SURFACE: colors.surface,
    COLOR_SURFACE_RGB: hexToRgb(colors.surface),
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

    // Logo (dynamic gradient square with first letter)
    LOGO_ICON: logoSvg,
    FAVICON_SVG: encodeURIComponent(faviconSvg),

    // Hero content
    HERO_HEADLINE: content.heroHeadline,
    HERO_SUBHEADLINE: content.heroSubheadline,
    HERO_IMAGE_ALT: `${content.siteName} - ${content.tagline}`,

    // Features content - dynamically generated
    FEATURES_TITLE: content.featuresTitle,
    FEATURES_HTML: generateFeatureCardsHtml(content, featureCount, cardStyle.className, logoSvg, featureLayout.gridClass),

    // About content
    ABOUT_TITLE: content.aboutTitle,
    ABOUT_DESCRIPTION: content.aboutDescription,

    // Footer
    FOOTER_TAGLINE: content.footerTagline,

    // NEW: Feature Layout
    FEATURE_GRID_CLASS: featureLayout.gridClass,
    FEATURE_CARD_CLASS: featureLayout.cardClass,
    FEATURE_LAYOUT_ID: featureLayout.id,

    // NEW: Button Style
    BUTTON_STYLE_CLASS: buttonStyle.className,
    BUTTON_STYLE_CSS: buttonStyle.css,

    // NEW: Card Style
    CARD_STYLE_CLASS: cardStyle.className,
    CARD_STYLE_CSS: cardStyle.css,

    // NEW: Typography
    HEADING_WEIGHT: typography.headingWeight,
    HEADING_TRANSFORM: typography.headingTransform,
    HEADING_LETTER_SPACING: typography.headingLetterSpacing,
    BODY_LINE_HEIGHT: typography.bodyLineHeight,

    // NEW: Hero Background
    HERO_BG_CLASS: heroBackground.className,
    HERO_OVERLAY_STYLE: heroBackground.overlayStyle,

    // NEW: Hover Effects
    CARD_HOVER_STYLE: hoverEffect.cardHover,
    BUTTON_HOVER_EFFECT: hoverEffect.buttonHover,

    // Dynamic sections
    OPTIONAL_SECTIONS_HTML: generateOptionalSectionsHtml(optionalSections, content.siteName, niche, cardStyle.className),
    NAV_HTML: generateNavHtml(navLayout, content.siteName, logoSvg, niche),
    FOOTER_HTML: generateFooterHtml(footerLayout, content.siteName, logoSvg, content.footerTagline, niche, currentYear),

    // Class prefix for anti-fingerprinting
    CLASS_PREFIX: classPrefix,

    // Themed slot symbols
    SLOT_SYMBOLS_JSON: JSON.stringify(symbolSet.symbols.map(s => s.emoji)),
    SLOT_MULTIPLIERS_JSON: JSON.stringify(
      symbolSet.symbols.reduce((acc, s) => {
        acc[s.emoji] = s.multiplier;
        return acc;
      }, {} as Record<string, number>)
    ),
    SLOT_THEME_NAME: symbolSet.name,
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

// Apply class prefix to randomize class names for anti-fingerprinting
// NOTE: We're disabling class prefixing for now as it breaks JavaScript selectors
// TODO: If re-enabling, need to also update JS querySelector calls
function applyClassPrefix(content: string, prefix: string, isCSS: boolean): string {
  // Disabled: Class prefixing breaks JavaScript DOM selectors
  // The slot machine and other interactive elements use querySelector/getElementById
  // which won't find the prefixed class names
  return content;
}

// ============================================================================
// Main Assembly Function (using embedded templates)
// ============================================================================

// Generate random class prefix for anti-fingerprinting
function generateClassPrefix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  let prefix = chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 3; i++) {
    prefix += (Math.random() > 0.5 ? chars : nums)[Math.floor(Math.random() * (Math.random() > 0.5 ? chars.length : nums.length))];
  }
  return prefix + '_';
}

export async function assembleWebsiteFromFiles(options: AssembleOptions): Promise<Buffer> {
  const { niche, images, domain } = options;

  // Use provided presets or generate random ones
  const presets = options.presets || selectRandomPresets();

  // Determine feature count from images or default
  const featureCount = options.featureCount || images.features?.length || 3;

  // Select random optional sections
  const optionalSections = selectOptionalSections();

  // Select random nav and footer layouts
  const navLayout = NAV_LAYOUTS[Math.floor(Math.random() * NAV_LAYOUTS.length)];
  const footerLayout = FOOTER_LAYOUTS[Math.floor(Math.random() * FOOTER_LAYOUTS.length)];

  // Select themed symbols based on description
  const symbolSet = selectSymbolSet(domain || "");

  // Generate class prefix for anti-fingerprinting
  const classPrefix = generateClassPrefix();

  // Build variable map
  const variables = buildVariables(
    options,
    presets,
    featureCount,
    optionalSections,
    navLayout,
    footerLayout,
    symbolSet,
    classPrefix
  );

  // Create ZIP archive
  const zip = new JSZip();

  // Process templates: replace variables, then apply class prefix
  const processHtml = (template: string) =>
    applyClassPrefix(replaceVariables(template, variables), classPrefix, false);
  const processCss = (template: string) =>
    applyClassPrefix(replaceVariables(template, variables), classPrefix, true);
  const processJs = (template: string) => replaceVariables(template, variables);

  // Add base templates (embedded)
  zip.file("index.html", processHtml(INDEX_TEMPLATE));
  zip.file("terms.html", processHtml(TERMS_TEMPLATE));
  zip.file("privacy.html", processHtml(PRIVACY_TEMPLATE));
  zip.file("css/style.css", processCss(STYLE_TEMPLATE));

  // Add niche-specific templates
  if (niche === "social-casino") {
    zip.file("play.html", processHtml(PLAY_TEMPLATE));
    zip.file("css/slots.css", processCss(SLOTS_CSS_TEMPLATE));
    zip.file("js/slots.js", processJs(SLOTS_JS_TEMPLATE));
  }

  // Add images
  zip.file("images/hero.png", images.hero);

  // Add feature images dynamically
  if (images.features && images.features.length > 0) {
    for (let i = 0; i < images.features.length; i++) {
      zip.file(`images/feature${i + 1}.png`, images.features[i]);
    }
  }

  // Add np/ cloaker files
  for (const [filePath, content] of Object.entries(NP_FILES)) {
    zip.file(filePath, content);
  }

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
    logo: "Dynamic Gradient Letter",
    featureLayout: presets.featureLayout.name,
    buttonStyle: presets.buttonStyle.name,
    cardStyle: presets.cardStyle.name,
    typography: presets.typography.name,
    heroBackground: presets.heroBackground.name,
    hoverEffect: presets.hoverEffect.name,
  };
}
