class WordleSolver {
    constructor() {
        this.wordList = [];
        this.possibleWords = [];
        this.attempts = [];
        this.currentAttempt = 0;
        this.topSuggestions = [];
        this.currentSuggestionIndex = 0;

        // Best mathematical openers (computed offline)
        this.bestOpeners = ['SALET', 'ROATE', 'TRACE', 'CRANE', 'REAST'];

        this.init();
    }

    async init() {
        await this.loadWordList();
        this.initializeGrid();
        this.setupEventListeners();

        // Suggest a starter word immediately if it's the first turn
        this.updateSuggestionUI(this.bestOpeners[0], "Best Opener", 5.8);
    }

    async loadWordList() {
        try {
            const response = await fetch('target_5_letters.txt');
            const text = await response.text();
            this.wordList = text.trim().split('\n')
                .map(word => word.trim().toUpperCase())
                .filter(word => word.length === 5);
            this.possibleWords = [...this.wordList];
            this.updateStats();
        } catch (error) {
            console.error('Failed to load word list:', error);
            // Fallback small list for testing if file fails
            this.wordList = ['CRANE', 'SALET', 'TRACE', 'APPLE', 'BERRY'];
            this.possibleWords = [...this.wordList];
        }
    }

    initializeGrid() {
        const grid = document.getElementById('wordleGrid');
        grid.innerHTML = '';

        for (let row = 0; row < 6; row++) {
            const wordRow = document.createElement('div');
            wordRow.className = 'word-row';
            wordRow.dataset.row = row;

            for (let col = 0; col < 5; col++) {
                const cell = document.createElement('div');
                cell.className = 'letter-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.dataset.state = 'empty';

                // Add ripple effect container or handler if needed
                cell.addEventListener('click', () => this.toggleCellState(cell));

                wordRow.appendChild(cell);
            }
            grid.appendChild(wordRow);
        }
    }

    setupEventListeners() {
        const wordInput = document.getElementById('wordInput');

        document.getElementById('addWordBtn').addEventListener('click', () => this.handleAddWord());
        document.getElementById('getSuggestionBtn').addEventListener('click', () => this.handleGetSuggestion());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());

        wordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddWord();
        });

        wordInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        });
    }

    toggleCellState(cell) {
        // Prevent changing previous rows
        if (parseInt(cell.dataset.row) !== this.currentAttempt &&
            parseInt(cell.dataset.row) !== this.currentAttempt - 1) {
            return;
        }

        // Logic: Empty -> Black (Incorrect) -> Yellow (Present) -> Green (Correct) -> Black...
        // But for a new row input, it usually starts with letters.
        // If empty, do nothing (must type word first).
        if (!cell.textContent) return;

        const states = ['black', 'yellow', 'green'];
        let currentState = cell.dataset.state;
        if (currentState === 'empty') currentState = 'black'; // Start cycle

        const currentIndex = states.indexOf(currentState);
        const nextIndex = (currentIndex + 1) % states.length;
        const nextState = states[nextIndex];

        cell.dataset.state = nextState;

        // Update UI immediately
        cell.className = `letter-cell`; // Reset
        // Trigger reflow for animation if needed
        void cell.offsetWidth;
        cell.setAttribute('data-state', nextState);
        cell.classList.add('letter-cell'); // Re-add base class

        // Show "Get Suggestion" if this was the last edit needed
        this.checkInputState();
    }

    handleAddWord() {
        const input = document.getElementById('wordInput');
        const word = input.value.trim().toUpperCase();

        if (word.length !== 5) {
            this.showToast("Enter a 5-letter word");
            return;
        }

        if (this.currentAttempt >= 6) return;

        // Fill grid
        const row = document.querySelector(`[data-row="${this.currentAttempt}"]`);
        const cells = row.querySelectorAll('.letter-cell');

        for (let i = 0; i < 5; i++) {
            cells[i].textContent = word[i];
            cells[i].dataset.state = 'black'; // Default to incorrect
        }

        this.currentAttempt++;
        input.value = '';

        // Switch controls
        document.getElementById('addWordBtn').style.display = 'none';
        document.getElementById('getSuggestionBtn').style.display = 'flex';

        // Instructions update
        this.showToast("Click letters to set colors (Gray/Yellow/Green)");
    }

    checkInputState() {
        // Check if current row has all colors set (which defaults to yes after Add Word)
        // Just ensures buttons are in correct state
    }

    handleGetSuggestion() {
        // Read the previous attempt's feedback
        const rowIdx = this.currentAttempt - 1;
        if (rowIdx < 0) return;

        const row = document.querySelector(`[data-row="${rowIdx}"]`);
        const cells = row.querySelectorAll('.letter-cell');

        const word = Array.from(cells).map(c => c.textContent).join('');
        const feedback = Array.from(cells).map(c => c.dataset.state); // black, yellow, green

        // 1. Filter Possible Words
        const prevCount = this.possibleWords.length;
        this.filterPossibleWords(word, feedback);
        const newCount = this.possibleWords.length;

        this.attempts.push({ word, feedback });
        this.updateStats();

        if (newCount === 0) {
            this.updateSuggestionUI("ERROR", "No words match", 0);
            return;
        }

        if (newCount === 1) {
            this.updateSuggestionUI(this.possibleWords[0], "The Answer!", 0);
            // Victory animation?
            return;
        }

        // 2. Calculate Next Suggestion
        this.calculateBestMove();

        // Reset UI for next input
        document.getElementById('getSuggestionBtn').style.display = 'none';
        document.getElementById('addWordBtn').style.display = 'flex';

        // Focus input
        document.getElementById('wordInput').focus();
    }

    filterPossibleWords(guess, feedback) {
        this.possibleWords = this.possibleWords.filter(candidate => {
            return this.checkConsistency(candidate, guess, feedback);
        });
    }

    checkConsistency(candidate, guess, feedback) {
        const candArr = candidate.split('');
        const guessArr = guess.split('');

        // 1. Check Greens (Correct position)
        for (let i = 0; i < 5; i++) {
            if (feedback[i] === 'green') {
                if (candArr[i] !== guessArr[i]) return false;
                candArr[i] = null; // Mark as matched
                guessArr[i] = null;
            }
        }

        // 2. Check Yellows (Present but wrong pos) and Blacks (Absent)
        for (let i = 0; i < 5; i++) {
            if (feedback[i] === 'green') continue; // Already handled

            const letter = guessArr[i]; // Original letter from guess

            if (feedback[i] === 'yellow') {
                // Must exist in candidate (non-matched parts)
                const idx = candArr.indexOf(letter);
                if (idx === -1) return false;

                // Must NOT be in the same position (implicit in yellow)
                // Actually, if it was same position it would be green.
                // But we must ensure we don't match the same index if we iterate?
                // The check `candArr[i] !== letter` is redundant if logic is perfect but safe.
                if (candidate[i] === letter) return false;

                candArr[idx] = null; // Consume
            } else if (feedback[i] === 'black') {
                // Must not exist in remaining candidate slots
                // BUT, handle double letters:
                // Guess "SPEED", answer "ABIDE".
                // E1 (green) matches. E2 (black) means no *more* Es.
                if (candArr.includes(letter)) return false;
            }
        }
        return true;
    }

    calculateBestMove() {
        document.querySelector('.suggestion-box').style.display = 'block';
        document.querySelector('.suggestion-word').textContent = '...';
        document.querySelector('.suggestion-label').textContent = 'CALCULATING';

        // Use setTimeout to allow UI to render "Thinking..." state
        setTimeout(() => {
            const suggestions = this.getSuggestions();
            if (suggestions.length > 0) {
                const best = suggestions[0];
                this.updateSuggestionUI(best.word, `Entropy: ${best.score.toFixed(2)}`, best.score);
            }
        }, 50);
    }

    getSuggestions() {
        // Strategy:
        // 1. If very few words left, just pick one (Exploitation)
        if (this.possibleWords.length <= 2) {
            return this.possibleWords.map(w => ({ word: w, score: 99 }));
        }

        // 2. If early game (lots of words), pick best eliminator from ALL words (Exploration)
        // 3. If late game (few words), prefer possible words but still consider eliminators

        // Optimization: Reduce search space for candidate words (the words we evaluate as guesses)
        // Evaluating all 15k words against 2k possible words is slow (30M ops).
        // Evaluating top 200 likely words against 2k possible words is fast.

        let candidatePool = this.wordList;

        // Heuristic: Pre-filter candidates based on letter frequency in possible set
        // to find good splitters without running full entropy
        if (this.possibleWords.length > 2) {
            candidatePool = this.getHeuristicCandidates(200);
        }

        const scoredCandidates = [];

        for (const word of candidatePool) {
            const entropy = this.calculateEntropy(word);
            let score = entropy;

            // HYBRID SCORING:
            // If the word is a possible answer, give it a small bonus.
            // This acts as a tie-breaker or "switch to exploitation" when entropy is similar.
            // Bonus increases as pool shrinks.
            if (this.possibleWords.includes(word)) {
                // If pool is small (<20), winning is valuable.
                if (this.possibleWords.length < 20) {
                    score += 0.5; // Equivalent to eliminating ~30% more words
                } else {
                    score += 0.1; // Tie-breaker
                }
            }

            scoredCandidates.push({ word, score, entropy });
        }

        scoredCandidates.sort((a, b) => b.score - a.score);
        return scoredCandidates;
    }

    getHeuristicCandidates(limit) {
        // Frequency analysis of remaining words
        const freq = {};
        const count = this.possibleWords.length;

        // Count letter occurrence (document frequency)
        for (const w of this.possibleWords) {
            const seen = new Set(w);
            for (const l of seen) freq[l] = (freq[l] || 0) + 1;
        }

        // Score words by how close their letters' probabilities are to 0.5
        // Ideally we want letters that appear in 50% of remaining words.
        return this.wordList
            .map(word => {
                let score = 0;
                const seen = new Set(word);
                for (const l of seen) {
                    const p = (freq[l] || 0) / count;
                    score += 1 - Math.abs(2 * p - 1); // Peak at p=0.5
                }
                return { word, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(obj => obj.word);
    }

    calculateEntropy(guessWord) {
        const buckets = {};
        // Simulate guess against all possible words
        for (const target of this.possibleWords) {
            const pattern = this.getPattern(guessWord, target);
            buckets[pattern] = (buckets[pattern] || 0) + 1;
        }

        let entropy = 0;
        const total = this.possibleWords.length;

        for (const key in buckets) {
            const p = buckets[key] / total;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }

    getPattern(guess, target) {
        // Returns integer representation or string of pattern
        // 0: Black, 1: Yellow, 2: Green
        const p = [0,0,0,0,0];
        const gArr = guess.split('');
        const tArr = target.split('');

        // Green
        for (let i = 0; i < 5; i++) {
            if (gArr[i] === tArr[i]) {
                p[i] = 2;
                gArr[i] = null;
                tArr[i] = null;
            }
        }

        // Yellow
        for (let i = 0; i < 5; i++) {
            if (gArr[i] !== null) { // Not green
                const idx = tArr.indexOf(gArr[i]);
                if (idx !== -1) {
                    p[i] = 1;
                    tArr[idx] = null; // Consume
                }
            }
        }

        return p.join('');
    }

    updateSuggestionUI(word, label, score) {
        const box = document.querySelector('.suggestion-box');
        const wordEl = document.querySelector('.suggestion-word');
        const labelEl = document.querySelector('.suggestion-label');

        box.style.display = 'block';
        wordEl.textContent = word;
        labelEl.textContent = label; // e.g. "OPTIMAL GUESS" or "ENTROPY: 5.4"

        // Update meta stats
        document.getElementById('stat-entropy').textContent = score.toFixed(2);

        // Optional: Show expected remaining
        const reduction = Math.pow(2, score);
        // If score is entropy, reduction factor is 2^H.
        // Expected remaining = Total / 2^H.
        // But score might be modified. Let's just use approximate.

        // Animate
        wordEl.style.animation = 'none';
        wordEl.offsetHeight; /* trigger reflow */
        wordEl.style.animation = 'pulse-suggestion 2s infinite ease-in-out';
    }

    updateStats() {
        document.getElementById('stat-possible').textContent = this.possibleWords.length;
        document.getElementById('stat-attempts').textContent = this.currentAttempt;
    }

    resetGame() {
        this.possibleWords = [...this.wordList];
        this.attempts = [];
        this.currentAttempt = 0;

        this.initializeGrid();
        this.updateStats();

        document.querySelector('.suggestion-box').style.display = 'none';
        document.getElementById('addWordBtn').style.display = 'flex';
        document.getElementById('getSuggestionBtn').style.display = 'none';
        document.getElementById('wordInput').value = '';

        // Suggest opener again
        this.updateSuggestionUI(this.bestOpeners[0], "Best Opener", 5.8);
    }

    showToast(msg) {
        // Simple alert or custom toast could be added here
        // For now, console
        console.log(msg);
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    window.solver = new WordleSolver();
});
