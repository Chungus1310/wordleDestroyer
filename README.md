# Chun's Wordle Destroyer v2.0

Wordle Solving Engine and Interactive Practice System with Greedy Entropy Maximization and Minimax Lookahead.

[Live Demo on GitHub Pages](https://chungus1310.github.io/wordleDestroyer/)

## Overview

Wordle Destroyer is a lightweight web application designed to solve Wordle puzzles in the fewest possible steps. Version 2.0 introduces a greedy minimax lookahead engine that balances Shannon information entropy with direct win probability, reducing average solve length to 3.42 guesses on official Wordle answers.

The interface is built from the ground up for desktop monitors, tablets, and mobile phones, featuring an on-screen keyboard with live letter states, direct tile color cycling, rapid color palette shortcuts, and an interactive practice mode.

## Key Features

1. Mathematical Greedy Engine
The solver tracks 2,315 curated official Wordle targets and 14,855 dictionary words. Unlike simple frequency counters, it evaluates every candidate across 243 pattern buckets to minimize expected turns remaining. It automatically recognizes rhyming traps and suggests probe words to break them.

2. Responsive Design for Desktop and Mobile
The layout adapts seamlessly across screen widths from 320px mobile viewports up to 4K displays. Mobile users benefit from touch-optimized sizing, safe-area support, and a virtual QWERTY keyboard with real-time letter status updates.

3. Rapid Feedback Controls
Feedback colors can be set by tapping any letter tile to cycle through Gray, Yellow, and Green, or by using the color palette bar to paint tiles and mark entire rows with a single tap. Physical keyboard shortcuts (1 for Gray, 2 for Yellow, 3 for Green) speed up desktop entry.

4. Practice and Solver Modes
Switch between Solver Mode (for assisting with external Wordle games) and Practice Mode (an interactive standalone game with real-time AI move ratings and auto-solve capabilities).

5. Zero Dependencies and Offline Ready
Built with pure HTML5, modern CSS3, and vanilla JavaScript. All lexicon data is bundled locally, allowing the application to run directly from local storage or static hosting without network lag.

## Algorithmic Details

Given remaining target set S of size N and candidate guess word G:
Each guess generates a pattern in the range 0 to 242.
The solver computes:
- Shannon Entropy: H(G) = sum(-p * log2(p))
- Direct Win Probability: P(win) = count(all green) / N
- Expected Remaining Turns: computed using dynamic step costs based on partition bucket sizes.

When N is large, information entropy dominates to split the candidate pool rapidly. When N is small, direct win probability and partition safety take priority to secure victory in the minimum number of steps.

## Tested Openers

- SALET: Expected 3.42 steps, 5.83 bits of entropy.
- TARSE: Expected 3.44 steps, 5.95 bits of entropy.
- CRANE: Expected 3.44 steps, 5.74 bits of entropy.
- SLATE: Expected 3.44 steps, 5.86 bits of entropy.
- TRACE: Expected 3.45 steps, 5.83 bits of entropy.

## Project Structure

- `index.html`: Semantic application markup, grid structure, and dashboard layout.
- `style.css`: Responsive cyberpunk dark theme, animations, and touch controls.
- `words.js`: Fast unpacked lexicon containing 2,315 targets and 12,540 auxiliary probe words.
- `script.js`: Core solver algorithm, state management, audio synthesis, and event handlers.
- `target_5_letters.txt`: Full 14,855 dictionary word list.
- `official_targets.txt`: Curated 2,315 Wordle solution list.

## License

MIT License. Engineered by Chun.
