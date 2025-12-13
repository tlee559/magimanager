/**
 * Social Casino Slot Machine
 *
 * A free-to-play slot machine game for entertainment only.
 * No real money involved - virtual credits have no cash value.
 */

(function() {
  'use strict';

  // ============================================================================
  // Configuration
  // ============================================================================

  const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '📊', '⭐'];

  const MULTIPLIERS = {
    '🍒': 2,
    '🍋': 3,
    '🍊': 4,
    '🍇': 5,
    '⭐': 8,
    '💎': 10,
    '📊': 15,
    '7️⃣': 20
  };

  const REEL_COUNT = 5;
  const VISIBLE_SYMBOLS = 3;
  const SYMBOL_HEIGHT = 86.67;
  const SPIN_DURATION = 2000;
  const REEL_DELAY = 200;

  const MIN_BET = 10;
  const MAX_BET = 100;
  const BET_INCREMENT = 10;
  const STARTING_CREDITS = 1000;

  // ============================================================================
  // State
  // ============================================================================

  let credits = parseInt(localStorage.getItem('slotCredits')) || STARTING_CREDITS;
  let currentBet = MIN_BET;
  let isSpinning = false;
  let reelSymbols = [];

  // ============================================================================
  // DOM Elements
  // ============================================================================

  const creditsDisplay = document.getElementById('credits');
  const lastWinDisplay = document.getElementById('last-win');
  const betDisplay = document.getElementById('current-bet');
  const spinButton = document.getElementById('spin-btn');
  const winMessage = document.getElementById('win-message');
  const winType = document.getElementById('win-type');
  const winAmount = document.getElementById('win-amount');
  const winLine = document.querySelector('.win-line');

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    // Initialize each reel with random symbols
    for (let i = 0; i < REEL_COUNT; i++) {
      reelSymbols[i] = generateReelSymbols();
      renderReel(i);
    }

    updateDisplay();
  }

  function generateReelSymbols() {
    // Generate a strip of symbols (more than visible for smooth animation)
    const strip = [];
    for (let i = 0; i < 30; i++) {
      strip.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }
    return strip;
  }

  function renderReel(reelIndex) {
    const reel = document.getElementById(`reel-${reelIndex}`);
    reel.innerHTML = '';

    reelSymbols[reelIndex].forEach(symbol => {
      const div = document.createElement('div');
      div.className = 'symbol';
      div.textContent = symbol;
      reel.appendChild(div);
    });
  }

  // ============================================================================
  // Display Updates
  // ============================================================================

  function updateDisplay() {
    creditsDisplay.textContent = credits.toLocaleString();
    betDisplay.textContent = currentBet;

    // Save credits to localStorage
    localStorage.setItem('slotCredits', credits);
  }

  function showWinMessage(amount, type) {
    winType.textContent = type;
    winAmount.textContent = `+${amount.toLocaleString()}`;
    winMessage.classList.add('active');
    winLine.classList.add('active');

    setTimeout(() => {
      winMessage.classList.remove('active');
      winLine.classList.remove('active');
    }, 2000);
  }

  // ============================================================================
  // Bet Controls
  // ============================================================================

  window.increaseBet = function() {
    if (currentBet < MAX_BET && currentBet < credits) {
      currentBet = Math.min(currentBet + BET_INCREMENT, MAX_BET, credits);
      updateDisplay();
    }
  };

  window.decreaseBet = function() {
    if (currentBet > MIN_BET) {
      currentBet = Math.max(currentBet - BET_INCREMENT, MIN_BET);
      updateDisplay();
    }
  };

  window.maxBet = function() {
    currentBet = Math.min(MAX_BET, credits);
    updateDisplay();
  };

  // ============================================================================
  // Spin Logic
  // ============================================================================

  window.spin = function() {
    if (isSpinning || credits < currentBet) return;

    isSpinning = true;
    spinButton.disabled = true;
    spinButton.classList.add('spinning');

    // Deduct bet
    credits -= currentBet;
    lastWinDisplay.textContent = '0';
    updateDisplay();

    // Generate new results
    const results = [];
    for (let i = 0; i < REEL_COUNT; i++) {
      results.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }

    // Animate each reel
    const promises = [];
    for (let i = 0; i < REEL_COUNT; i++) {
      promises.push(spinReel(i, results[i], i * REEL_DELAY));
    }

    // Wait for all reels to stop
    Promise.all(promises).then(() => {
      // Check for wins
      const win = calculateWin(results);

      if (win > 0) {
        credits += win;
        lastWinDisplay.textContent = win.toLocaleString();
        updateDisplay();

        // Show win message based on amount
        let type = 'WIN!';
        if (win >= currentBet * 10) type = 'MEGA WIN!';
        else if (win >= currentBet * 5) type = 'BIG WIN!';
        else if (win >= currentBet * 2) type = 'NICE WIN!';

        showWinMessage(win, type);
      }

      // Reset for next spin
      isSpinning = false;
      spinButton.disabled = false;
      spinButton.classList.remove('spinning');

      // Auto-refill if out of credits (it's free to play!)
      if (credits < MIN_BET) {
        setTimeout(() => {
          credits = STARTING_CREDITS;
          updateDisplay();
        }, 1500);
      }
    });
  };

  function spinReel(reelIndex, targetSymbol, delay) {
    return new Promise(resolve => {
      setTimeout(() => {
        const reel = document.getElementById(`reel-${reelIndex}`);

        // Regenerate symbols with target at center position
        const newSymbols = [];

        // Add random symbols before
        for (let i = 0; i < 20; i++) {
          newSymbols.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        }

        // Add final symbols (target in center)
        newSymbols.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        newSymbols.push(targetSymbol);
        newSymbols.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);

        reelSymbols[reelIndex] = newSymbols;
        renderReel(reelIndex);

        // Reset position
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(0)';

        // Force reflow
        reel.offsetHeight;

        // Animate to final position
        const finalOffset = -(newSymbols.length - VISIBLE_SYMBOLS) * SYMBOL_HEIGHT;
        reel.style.transition = `transform ${SPIN_DURATION - delay}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
        reel.style.transform = `translateY(${finalOffset}px)`;

        setTimeout(resolve, SPIN_DURATION - delay);
      }, delay);
    });
  }

  // ============================================================================
  // Win Calculation
  // ============================================================================

  function calculateWin(results) {
    let totalWin = 0;

    // Check for consecutive matches from left
    let matchCount = 1;
    const firstSymbol = results[0];

    for (let i = 1; i < results.length; i++) {
      if (results[i] === firstSymbol) {
        matchCount++;
      } else {
        break;
      }
    }

    // Calculate win based on matches
    if (matchCount >= 3) {
      const baseMultiplier = MULTIPLIERS[firstSymbol] || 2;
      let winMultiplier = baseMultiplier;

      // Bonus for more matches
      if (matchCount === 4) winMultiplier *= 2;
      if (matchCount === 5) winMultiplier *= 5;

      totalWin = currentBet * winMultiplier;
    }

    // Check for any 3 of a kind (not consecutive)
    if (totalWin === 0) {
      const symbolCounts = {};
      results.forEach(s => {
        symbolCounts[s] = (symbolCounts[s] || 0) + 1;
      });

      for (const [symbol, count] of Object.entries(symbolCounts)) {
        if (count >= 3) {
          const baseMultiplier = MULTIPLIERS[symbol] || 2;
          // Reduced multiplier for non-consecutive
          totalWin = Math.max(totalWin, currentBet * Math.floor(baseMultiplier / 2));
        }
      }
    }

    return totalWin;
  }

  // ============================================================================
  // Initialize on Load
  // ============================================================================

  init();

})();
