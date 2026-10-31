/**
 * Wordle Destroyer v2.0 - Core Engine
 * Engineered with precision by Chun
 * Greedy entropy maximization, expected turns minimization, and responsive mobile/desktop UI.
 */

class WordleDestroyerApp {
    constructor() {
        this.targets = [];
        this.targetSet = new Set();
        this.probes = [];
        this.dictionary = [];
        this.dictionarySet = new Set();

        // Game State
        this.currentRow = 0;
        this.selectedTileCol = 0;
        this.survivingTargets = [];
        this.history = []; // Array of { word, feedback, survivingCount }
        this.isGameOver = false;

        // Modes: 'solver' or 'practice'
        this.mode = 'solver';
        this.practiceSecret = '';

        // Audio synthesizer
        this.audioCtx = null;

        // Best precalculated openers (Alex Selby & 3b1b standard)
        this.openers = [
            { word: 'SALET', ent: 5.83, expSteps: 3.42, winProb: 0.0004, tag: 'MIN-STEPS CHAMP' },
            { word: 'TARSE', ent: 5.95, expSteps: 3.44, winProb: 0.0004, tag: 'MAX-ENTROPY' },
            { word: 'CRANE', ent: 5.74, expSteps: 3.44, winProb: 0.0004, tag: 'COMMUNITY FAV' },
            { word: 'SLATE', ent: 5.86, expSteps: 3.44, winProb: 0.0004, tag: 'BALANCED' },
            { word: 'TRACE', ent: 5.83, expSteps: 3.45, winProb: 0.0004, tag: 'BALANCED' }
        ];

        this.init();
    }

    init() {
        this.loadLexicon();
        this.renderBoard();
        this.renderKeyboard();
        this.attachEventListeners();
        this.resetGame();
    }

    /* ----------------------------------------------------
       Lexicon & Data Loading
    ---------------------------------------------------- */
    loadLexicon() {
        const root = (typeof window !== 'undefined') ? window : globalThis;
        const rawTargets = root.WORDLE_TARGETS_RAW || '';
        const rawProbes = root.WORDLE_PROBES_RAW || '';

        this.targets = [];
        for (let i = 0; i < rawTargets.length; i += 5) {
            this.targets.push(rawTargets.slice(i, i + 5));
        }
        this.targetSet = new Set(this.targets);

        this.probes = [];
        for (let i = 0; i < rawProbes.length; i += 5) {
            this.probes.push(rawProbes.slice(i, i + 5));
        }

        this.dictionary = [...this.targets, ...this.probes];
        this.dictionarySet = new Set(this.dictionary);
        this.survivingTargets = [...this.targets];
    }

    /* ----------------------------------------------------
       High-Speed Pattern Matching (0..242)
       0: Gray (absent), 1: Yellow (present), 2: Green (correct)
    ---------------------------------------------------- */
    getPattern(g, t) {
        let p0 = g[0] === t[0] ? 2 : 0;
        let p1 = g[1] === t[1] ? 2 : 0;
        let p2 = g[2] === t[2] ? 2 : 0;
        let p3 = g[3] === t[3] ? 2 : 0;
        let p4 = g[4] === t[4] ? 2 : 0;

        let r0 = p0 ? ' ' : t[0];
        let r1 = p1 ? ' ' : t[1];
        let r2 = p2 ? ' ' : t[2];
        let r3 = p3 ? ' ' : t[3];
        let r4 = p4 ? ' ' : t[4];

        if (!p0) {
            if (g[0] === r0) { p0 = 1; r0 = ' '; }
            else if (g[0] === r1) { p0 = 1; r1 = ' '; }
            else if (g[0] === r2) { p0 = 1; r2 = ' '; }
            else if (g[0] === r3) { p0 = 1; r3 = ' '; }
            else if (g[0] === r4) { p0 = 1; r4 = ' '; }
        }
        if (!p1) {
            if (g[1] === r0) { p1 = 1; r0 = ' '; }
            else if (g[1] === r1) { p1 = 1; r1 = ' '; }
            else if (g[1] === r2) { p1 = 1; r2 = ' '; }
            else if (g[1] === r3) { p1 = 1; r3 = ' '; }
            else if (g[1] === r4) { p1 = 1; r4 = ' '; }
        }
        if (!p2) {
            if (g[2] === r0) { p2 = 1; r0 = ' '; }
            else if (g[2] === r1) { p2 = 1; r1 = ' '; }
            else if (g[2] === r2) { p2 = 1; r2 = ' '; }
            else if (g[2] === r3) { p2 = 1; r3 = ' '; }
            else if (g[2] === r4) { p2 = 1; r4 = ' '; }
        }
        if (!p3) {
            if (g[3] === r0) { p3 = 1; r0 = ' '; }
            else if (g[3] === r1) { p3 = 1; r1 = ' '; }
            else if (g[3] === r2) { p3 = 1; r2 = ' '; }
            else if (g[3] === r3) { p3 = 1; r3 = ' '; }
            else if (g[3] === r4) { p3 = 1; r4 = ' '; }
        }
        if (!p4) {
            if (g[4] === r0) { p4 = 1; r0 = ' '; }
            else if (g[4] === r1) { p4 = 1; r1 = ' '; }
            else if (g[4] === r2) { p4 = 1; r2 = ' '; }
            else if (g[4] === r3) { p4 = 1; r3 = ' '; }
            else if (g[4] === r4) { p4 = 1; r4 = ' '; }
        }

        return p0 + p1 * 3 + p2 * 9 + p3 * 27 + p4 * 81;
    }

    feedbackToPattern(feedback) {
        let val = 0;
        let mult = 1;
        for (let i = 0; i < 5; i++) {
            let trit = 0;
            if (feedback[i] === 'correct') trit = 2;
            else if (feedback[i] === 'present') trit = 1;
            val += trit * mult;
            mult *= 3;
        }
        return val;
    }

    patternToFeedback(pattern) {
        const feedback = [];
        let p = pattern;
        for (let i = 0; i < 5; i++) {
            const trit = p % 3;
            p = Math.floor(p / 3);
            if (trit === 2) feedback.push('correct');
            else if (trit === 1) feedback.push('present');
            else feedback.push('absent');
        }
        return feedback;
    }

    /* ----------------------------------------------------
       Greedy Solver: Information Gain + Expected Turns
    ---------------------------------------------------- */
    computeBestMoves(limit = 5) {
        const pool = this.survivingTargets;
        const N = pool.length;

        if (N === 0) {
            return [];
        }

        if (this.currentRow === 0) {
            return this.openers.slice(0, limit);
        }

        if (N === 1) {
            return [{
                word: pool[0],
                ent: 0.0,
                expSteps: 1.0,
                winProb: 1.0,
                tag: 'DEFINITE WINNER'
            }];
        }

        if (N === 2) {
            return [
                { word: pool[0], ent: 1.0, expSteps: 1.5, winProb: 0.5, tag: '50% COIN FLIP' },
                { word: pool[1], ent: 1.0, expSteps: 1.5, winProb: 0.5, tag: '50% COIN FLIP' }
            ];
        }

        // Candidate guesses to evaluate:
        // Always include all surviving targets.
        // If pool is moderate, also evaluate top probe words from dictionary to avoid rhyme traps.
        let candidates = [...pool];

        if (N <= 250 && N > 2) {
            const probeCandidates = this.getHeuristicProbeCandidates(120);
            for (const pw of probeCandidates) {
                if (!candidates.includes(pw)) {
                    candidates.push(pw);
                }
            }
        } else if (N > 250) {
            // For large candidate sets early on, evaluate top 100 targets plus top 50 dictionary words
            candidates = this.getHeuristicProbeCandidates(150);
            for (let i = 0; i < Math.min(100, pool.length); i++) {
                if (!candidates.includes(pool[i])) {
                    candidates.push(pool[i]);
                }
            }
        }

        const stepCost = (k) => {
            if (k <= 1) return 0;
            if (k === 2) return 0.5;
            if (k === 3) return 0.8;
            return 0.8 + 0.65 * Math.log2(k / 3);
        };

        const scored = [];

        for (const word of candidates) {
            const buckets = new Int16Array(243);
            for (let i = 0; i < N; i++) {
                buckets[this.getPattern(word, pool[i])]++;
            }

            let ent = 0;
            const cWin = buckets[242]; // Exact win (all 5 green)
            const isTarget = this.targetSet.has(word);
            let expSteps = (N - cWin) / N;

            for (let b = 0; b < 243; b++) {
                const c = buckets[b];
                if (c > 0) {
                    const p = c / N;
                    ent -= p * Math.log2(p);
                    if (b !== 242) {
                        expSteps += p * (1 + stepCost(c));
                    }
                }
            }

            const winProb = cWin / N;
            let tag = isTarget ? 'TARGET WORD' : 'PROBE SPLITTER';
            if (winProb >= 0.25) tag = 'HIGH WIN PROB';

            scored.push({
                word,
                ent,
                expSteps,
                winProb,
                tag,
                isTarget
            });
        }

        // Sort by least expected steps first, break ties with higher entropy and target priority
        scored.sort((a, b) => {
            if (Math.abs(a.expSteps - b.expSteps) > 0.03) {
                return a.expSteps - b.expSteps;
            }
            if (Math.abs(a.ent - b.ent) > 0.05) {
                return b.ent - a.ent;
            }
            if (a.isTarget !== b.isTarget) {
                return a.isTarget ? -1 : 1;
            }
            return b.winProb - a.winProb;
        });

        return scored.slice(0, limit);
    }

    getHeuristicProbeCandidates(limit = 100) {
        const pool = this.survivingTargets;
        const letterFreq = {};

        for (const w of pool) {
            const seen = new Set(w);
            for (const ch of seen) {
                letterFreq[ch] = (letterFreq[ch] || 0) + 1;
            }
        }

        const poolLen = pool.length;
        const scoredDict = [];

        for (const word of this.dictionary) {
            let score = 0;
            const seen = new Set(word);
            for (const ch of seen) {
                const count = letterFreq[ch] || 0;
                if (count > 0) {
                    const p = count / poolLen;
                    // Peak information gain occurs when probability is around 0.5
                    score += 1.0 - Math.abs(2 * p - 1.0);
                }
            }
            scoredDict.push({ word, score });
        }

        scoredDict.sort((a, b) => b.score - a.score);
        return scoredDict.slice(0, limit).map(item => item.word);
    }

    /* ----------------------------------------------------
       Board & UI Rendering
    ---------------------------------------------------- */
    renderBoard() {
        const board = document.getElementById('wordleBoard');
        board.innerHTML = '';

        for (let r = 0; r < 6; r++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'board-row' + (r === 0 ? ' active-row' : '');
            rowEl.dataset.row = r;

            for (let c = 0; c < 5; c++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.dataset.row = r;
                tile.dataset.col = c;
                tile.dataset.state = 'empty';
                tile.textContent = '';

                tile.addEventListener('click', () => this.handleTileClick(r, c));
                rowEl.appendChild(tile);
            }

            board.appendChild(rowEl);
        }
    }

    renderKeyboard() {
        const kb = document.getElementById('virtualKeyboard');
        kb.innerHTML = '';

        const rows = [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
        ];

        rows.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'keyboard-row';

            row.forEach(key => {
                const btn = document.createElement('button');
                btn.className = 'key-btn';
                btn.textContent = key;
                btn.dataset.key = key;

                if (key === 'ENTER' || key === '⌫') {
                    btn.classList.add('key-wide');
                }

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleKeyInput(key);
                });

                rowDiv.appendChild(btn);
            });

            kb.appendChild(rowDiv);
        });
    }

    attachEventListeners() {
        // Physical Keyboard Support
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSubmitRow();
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                this.handleBackspace();
            } else if (/^[a-zA-Z]$/.test(e.key)) {
                e.preventDefault();
                this.handleLetterInput(e.key.toUpperCase());
            } else if (e.key === '1') {
                e.preventDefault();
                this.setTileColor('absent');
            } else if (e.key === '2') {
                e.preventDefault();
                this.setTileColor('present');
            } else if (e.key === '3') {
                e.preventDefault();
                this.setTileColor('correct');
            }
        });

        // Action Buttons
        document.getElementById('submitRowBtn').addEventListener('click', () => this.handleSubmitRow());
        document.getElementById('undoRowBtn').addEventListener('click', () => this.handleUndoOrClear());
        document.getElementById('autoFillBtn').addEventListener('click', () => this.handleAutoFill());
        document.getElementById('resetAppBtn').addEventListener('click', () => this.resetGame());

        // Color Palette Chips
        document.getElementById('chipGrayBtn').addEventListener('click', () => this.setTileColor('absent'));
        document.getElementById('chipYellowBtn').addEventListener('click', () => this.setTileColor('present'));
        document.getElementById('chipGreenBtn').addEventListener('click', () => this.setTileColor('correct'));
        document.getElementById('chipAllGrayBtn').addEventListener('click', () => this.setAllTilesColor('absent'));

        // Mode Switching
        document.getElementById('modeSolverBtn').addEventListener('click', () => this.setMode('solver'));
        document.getElementById('modePracticeBtn').addEventListener('click', () => this.setMode('practice'));

        const giveHintBtn = document.getElementById('giveHintBtn');
        if (giveHintBtn) {
            giveHintBtn.addEventListener('click', () => this.handlePracticeHint());
        }
    }

    /* ----------------------------------------------------
       Input & Board Interaction
    ---------------------------------------------------- */
    handleTileClick(r, c) {
        if (this.isGameOver) return;
        if (r !== this.currentRow) return;

        const tile = this.getTile(r, c);
        if (!tile || !tile.textContent) return;

        this.selectedTileCol = c;

        // Cycle through: absent -> present -> correct -> absent
        const cycle = {
            'absent': 'present',
            'present': 'correct',
            'correct': 'absent',
            'filled': 'absent',
            'empty': 'absent'
        };

        const nextState = cycle[tile.dataset.state] || 'absent';
        tile.dataset.state = nextState;
        this.playTone(350 + c * 50, 'sine', 0.05);
        this.vibrate(10);
    }

    handleKeyInput(key) {
        if (this.isGameOver) return;

        if (key === 'ENTER') {
            this.handleSubmitRow();
        } else if (key === '⌫' || key === 'BACKSPACE') {
            this.handleBackspace();
        } else if (/^[A-Z]$/.test(key)) {
            this.handleLetterInput(key);
        }
    }

    handleLetterInput(letter) {
        if (this.currentRow >= 6 || this.isGameOver) return;

        // Find next empty tile in current row
        for (let c = 0; c < 5; c++) {
            const tile = this.getTile(this.currentRow, c);
            if (!tile.textContent) {
                tile.textContent = letter;
                tile.dataset.state = 'absent'; // Default to gray
                this.selectedTileCol = c;
                this.playTone(420, 'sine', 0.04);
                this.vibrate(8);
                break;
            }
        }
    }

    handleBackspace() {
        if (this.currentRow >= 6 || this.isGameOver) return;

        // Delete from the rightmost non-empty tile
        for (let c = 4; c >= 0; c--) {
            const tile = this.getTile(this.currentRow, c);
            if (tile.textContent) {
                tile.textContent = '';
                tile.dataset.state = 'empty';
                this.selectedTileCol = Math.max(0, c - 1);
                this.playTone(280, 'sine', 0.04);
                this.vibrate(8);
                break;
            }
        }
    }

    setTileColor(color) {
        if (this.isGameOver || this.currentRow >= 6) return;
        const tile = this.getTile(this.currentRow, this.selectedTileCol);
        if (tile && tile.textContent) {
            tile.dataset.state = color;
            this.playTone(color === 'correct' ? 600 : color === 'present' ? 480 : 320, 'sine', 0.05);
            this.vibrate(12);

            // Move to next tile automatically
            this.selectedTileCol = (this.selectedTileCol + 1) % 5;
        }
    }

    setAllTilesColor(color) {
        if (this.isGameOver || this.currentRow >= 6) return;
        for (let c = 0; c < 5; c++) {
            const tile = this.getTile(this.currentRow, c);
            if (tile && tile.textContent) {
                tile.dataset.state = color;
            }
        }
        this.playTone(340, 'triangle', 0.08);
        this.vibrate(15);
    }

    handleAutoFill() {
        if (this.isGameOver || this.currentRow >= 6) return;
        const recWordEl = document.getElementById('recWord');
        const word = recWordEl ? recWordEl.textContent.trim().toUpperCase() : '';

        if (word && word.length === 5 && word !== '...' && word !== 'VICTORY') {
            for (let c = 0; c < 5; c++) {
                const tile = this.getTile(this.currentRow, c);
                tile.textContent = word[c];
                tile.dataset.state = 'absent';
            }
            this.selectedTileCol = 0;
            this.playTone(540, 'sine', 0.06);
            this.vibrate(15);
            this.showToast(`Entered ${word}. Tap tiles to adjust colors, then Step.`);
        }
    }

    /* ----------------------------------------------------
       Submission, Filtering & Analysis
    ---------------------------------------------------- */
    handleSubmitRow() {
        if (this.isGameOver) return;
        if (this.currentRow >= 6) return;

        const rowTiles = [];
        let word = '';
        let feedback = [];

        for (let c = 0; c < 5; c++) {
            const tile = this.getTile(this.currentRow, c);
            if (!tile || !tile.textContent) {
                this.showToast('Please enter all 5 letters.');
                this.vibrate([30, 50, 30]);
                return;
            }
            word += tile.textContent.toUpperCase();
            feedback.push(tile.dataset.state);
        }

        // If in practice mode, automatically apply real feedback based on secret
        if (this.mode === 'practice' && this.practiceSecret) {
            const pat = this.getPattern(word, this.practiceSecret);
            feedback = this.patternToFeedback(pat);
            for (let c = 0; c < 5; c++) {
                this.getTile(this.currentRow, c).dataset.state = feedback[c];
            }
        }

        const pattern = this.feedbackToPattern(feedback);

        // Check for Win (All Green)
        if (pattern === 242) {
            this.triggerVictory(word);
            return;
        }

        // Filter surviving targets
        const prevCount = this.survivingTargets.length;
        let newSurviving = this.survivingTargets.filter(t => this.getPattern(word, t) === pattern);

        // If no official targets matched, fall back to checking entire dictionary
        if (newSurviving.length === 0) {
            const dictMatches = this.dictionary.filter(t => this.getPattern(word, t) === pattern);
            if (dictMatches.length > 0) {
                newSurviving = dictMatches;
                this.showToast(`Not in common targets. Found ${dictMatches.length} valid words in full dictionary.`);
            } else {
                this.showToast('Contradictory feedback! No valid words match this pattern.');
                this.vibrate([40, 80, 40]);
                return;
            }
        }

        // Save history for undo
        this.history.push({
            row: this.currentRow,
            word,
            feedback: [...feedback],
            surviving: [...this.survivingTargets]
        });

        this.survivingTargets = newSurviving;
        this.updateKeyboardColors(word, feedback);

        // Advance to next row
        this.currentRow++;
        this.selectedTileCol = 0;
        this.updateRowHighlights();

        if (this.currentRow >= 6) {
            this.isGameOver = true;
            this.showToast('Maximum turns reached. Game over!');
            this.updateSuggestionUI('NONE', 0, 0, 0, 'DEFEAT');
            return;
        }

        // Run solver analysis
        this.runAnalysis();
    }

    runAnalysis() {
        const topWordEl = document.getElementById('recWord');
        if (topWordEl) topWordEl.textContent = '...';

        setTimeout(() => {
            const moves = this.computeBestMoves(5);
            if (moves && moves.length > 0) {
                const best = moves[0];
                this.updateSuggestionUI(best.word, best.ent, best.expSteps, best.winProb, best.tag);
                this.renderAlternatives(moves.slice(1));
            } else {
                this.updateSuggestionUI('NONE', 0, 0, 0, 'EXHAUSTED');
                this.renderAlternatives([]);
            }
            this.updateStats();
            this.renderCandidatesDrawer();
        }, 15);
    }

    handleUndoOrClear() {
        if (this.isGameOver) {
            this.resetGame();
            return;
        }

        // If current row has any letters, clear current row
        let hasLetters = false;
        for (let c = 0; c < 5; c++) {
            const tile = this.getTile(this.currentRow, c);
            if (tile && tile.textContent) {
                hasLetters = true;
                tile.textContent = '';
                tile.dataset.state = 'empty';
            }
        }

        if (hasLetters) {
            this.selectedTileCol = 0;
            this.playTone(260, 'sine', 0.05);
            return;
        }

        // Otherwise roll back previous submitted row
        if (this.history.length > 0) {
            const last = this.history.pop();
            this.currentRow = last.row;
            this.survivingTargets = [...last.surviving];

            // Restore tiles on current row
            for (let c = 0; c < 5; c++) {
                const tile = this.getTile(this.currentRow, c);
                tile.textContent = last.word[c];
                tile.dataset.state = last.feedback[c];
            }

            this.updateRowHighlights();
            this.runAnalysis();
            this.rebuildKeyboardColors();
            this.playTone(320, 'sine', 0.06);
            this.showToast('Reverted previous turn.');
        }
    }

    triggerVictory(word) {
        this.isGameOver = true;
        const rowEl = document.querySelector(`.board-row[data-row="${this.currentRow}"]`);
        if (rowEl) rowEl.classList.add('row-won');

        this.updateSuggestionUI(word, 0, 0, 1.0, 'SOLVED IN ' + (this.currentRow + 1) + ' GUESSES');
        this.updateStats();
        this.showToast(`TARGET DESTROYED in ${this.currentRow + 1} steps!`);
        this.playVictoryFanfare();
        this.vibrate([50, 100, 50, 100, 150]);
    }

    /* ----------------------------------------------------
       UI Updates & Assistants
    ---------------------------------------------------- */
    updateSuggestionUI(word, ent, expSteps, winProb, tag) {
        const recWordEl = document.getElementById('recWord');
        const metricEntropyEl = document.getElementById('metricEntropy');
        const metricStepsEl = document.getElementById('metricSteps');
        const metricWinProbEl = document.getElementById('metricWinProb');
        const recTypeBadgeEl = document.getElementById('recTypeBadge');

        if (recWordEl) recWordEl.textContent = word;
        if (metricEntropyEl) metricEntropyEl.textContent = ent > 0 ? ent.toFixed(2) : '0.00';
        if (metricStepsEl) metricStepsEl.textContent = expSteps > 0 ? expSteps.toFixed(2) : '0.00';
        if (metricWinProbEl) metricWinProbEl.textContent = (winProb * 100).toFixed(1) + '%';
        if (recTypeBadgeEl) recTypeBadgeEl.textContent = tag || 'OPTIMAL';
    }

    renderAlternatives(moves) {
        const altListEl = document.getElementById('altList');
        if (!altListEl) return;
        altListEl.innerHTML = '';

        if (!moves || moves.length === 0) {
            altListEl.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:10px;">No secondary alternatives.</div>';
            return;
        }

        moves.forEach((m, idx) => {
            const row = document.createElement('div');
            row.className = 'alt-row';
            row.innerHTML = `
                <div class="alt-left">
                    <span class="alt-rank">#${idx + 2}</span>
                    <span class="alt-word">${m.word}</span>
                    <span class="alt-tag">${m.tag}</span>
                </div>
                <div class="alt-right">
                    <div class="alt-metric">
                        <div class="alt-metric-val">${m.expSteps.toFixed(2)}</div>
                        <div class="alt-metric-lbl">Steps</div>
                    </div>
                    <div class="alt-metric">
                        <div class="alt-metric-val" style="color:var(--accent-cyan);">${m.ent.toFixed(2)}</div>
                        <div class="alt-metric-lbl">Bits</div>
                    </div>
                </div>
            `;

            row.addEventListener('click', () => {
                for (let c = 0; c < 5; c++) {
                    const tile = this.getTile(this.currentRow, c);
                    tile.textContent = m.word[c];
                    tile.dataset.state = 'absent';
                }
                this.playTone(520, 'sine', 0.05);
                this.showToast(`Selected ${m.word}`);
            });

            altListEl.appendChild(row);
        });
    }

    updateStats() {
        const candEl = document.getElementById('statCandidates');
        const turnEl = document.getElementById('statTurn');
        const elimEl = document.getElementById('statEliminated');
        const candBadge = document.getElementById('candCountBadge');

        const remaining = this.survivingTargets.length;
        const total = this.targets.length;
        const eliminatedPct = ((total - remaining) / total * 100).toFixed(1);

        if (candEl) candEl.textContent = remaining.toLocaleString();
        if (turnEl) turnEl.textContent = `${this.currentRow + 1} / 6`;
        if (elimEl) elimEl.textContent = `${eliminatedPct}%`;
        if (candBadge) candBadge.textContent = `${remaining.toLocaleString()} words`;
    }

    renderCandidatesDrawer() {
        const wrap = document.getElementById('candContainer');
        if (!wrap) return;
        wrap.innerHTML = '';

        const maxDisplay = 100;
        const slice = this.survivingTargets.slice(0, maxDisplay);

        slice.forEach(w => {
            const chip = document.createElement('span');
            chip.className = 'cand-chip';
            chip.textContent = w;
            chip.title = 'Click to insert into row';

            chip.addEventListener('click', () => {
                for (let c = 0; c < 5; c++) {
                    const tile = this.getTile(this.currentRow, c);
                    tile.textContent = w[c];
                    tile.dataset.state = 'absent';
                }
                this.showToast(`Loaded ${w}`);
            });

            wrap.appendChild(chip);
        });

        if (this.survivingTargets.length > maxDisplay) {
            const more = document.createElement('span');
            more.style.fontSize = '0.75rem';
            more.style.color = 'var(--text-muted)';
            more.style.alignSelf = 'center';
            more.textContent = `+${this.survivingTargets.length - maxDisplay} more`;
            wrap.appendChild(more);
        }
    }

    updateKeyboardColors(word, feedback) {
        for (let i = 0; i < 5; i++) {
            const ch = word[i];
            const state = feedback[i];
            const keyBtn = document.querySelector(`.key-btn[data-key="${ch}"]`);
            if (keyBtn) {
                const currentState = keyBtn.dataset.state;
                // Green overrides Yellow and Gray; Yellow overrides Gray
                if (state === 'correct') {
                    keyBtn.dataset.state = 'correct';
                } else if (state === 'present' && currentState !== 'correct') {
                    keyBtn.dataset.state = 'present';
                } else if (state === 'absent' && currentState !== 'correct' && currentState !== 'present') {
                    keyBtn.dataset.state = 'absent';
                }
            }
        }
    }

    rebuildKeyboardColors() {
        // Reset all keys first
        document.querySelectorAll('.key-btn').forEach(btn => {
            btn.removeAttribute('data-state');
        });

        // Reapply based on active history
        for (const item of this.history) {
            this.updateKeyboardColors(item.word, item.feedback);
        }
    }

    updateRowHighlights() {
        document.querySelectorAll('.board-row').forEach(row => {
            const r = parseInt(row.dataset.row);
            if (r === this.currentRow) {
                row.classList.add('active-row');
            } else {
                row.classList.remove('active-row');
            }
        });
    }

    getTile(r, c) {
        return document.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
    }

    /* ----------------------------------------------------
       Modes: Solver vs Practice Match
    ---------------------------------------------------- */
    setMode(newMode) {
        this.mode = newMode;
        document.getElementById('modeSolverBtn').classList.toggle('active', newMode === 'solver');
        document.getElementById('modePracticeBtn').classList.toggle('active', newMode === 'practice');

        const practiceBanner = document.getElementById('practiceBanner');
        if (practiceBanner) {
            practiceBanner.style.display = (newMode === 'practice') ? 'flex' : 'none';
        }

        if (newMode === 'practice') {
            this.startPracticeGame();
        } else {
            this.resetGame();
        }
    }

    startPracticeGame() {
        this.resetGame();
        const randIdx = Math.floor(Math.random() * this.targets.length);
        this.practiceSecret = this.targets[randIdx];
        this.showToast('Practice game started. Type your guesses!');
    }

    handlePracticeHint() {
        if (this.mode !== 'practice' || this.isGameOver) return;
        this.handleAutoFill();
        setTimeout(() => this.handleSubmitRow(), 250);
    }

    /* ----------------------------------------------------
       Reset & Lifecycle
    ---------------------------------------------------- */
    resetGame() {
        this.currentRow = 0;
        this.selectedTileCol = 0;
        this.isGameOver = false;
        this.history = [];
        this.survivingTargets = [...this.targets];

        // Clear tiles
        document.querySelectorAll('.tile').forEach(tile => {
            tile.textContent = '';
            tile.dataset.state = 'empty';
        });

        // Clear row animations
        document.querySelectorAll('.board-row').forEach(row => {
            row.classList.remove('row-won');
        });

        this.updateRowHighlights();
        this.rebuildKeyboardColors();

        // Default to best opener
        const opener = this.openers[0];
        this.updateSuggestionUI(opener.word, opener.ent, opener.expSteps, opener.winProb, opener.tag);
        this.renderAlternatives(this.openers.slice(1));
        this.updateStats();
        this.renderCandidatesDrawer();
    }

    /* ----------------------------------------------------
       Audio Synthesizer & Haptics
    ---------------------------------------------------- */
    initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playTone(freq, type = 'sine', duration = 0.05) {
        try {
            this.initAudio();
            if (!this.audioCtx) return;

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {
            // Audio context blocked or unsupported
        }
    }

    playVictoryFanfare() {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 'triangle', 0.2), idx * 120);
        });
    }

    vibrate(pattern) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {}
        }
    }

    showToast(msg) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2400);
    }
}

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
    window.destroyerApp = new WordleDestroyerApp();
});
