// Models
class CacheLine {
    constructor() {
        this.block = -1;
        this.valid = false;
        this.dirty = false;
        this.lastUsed = 0;
        this.insertedTime = 0;
    }
}

class CacheSimulator {
    constructor(totalCacheBlocks, ways, policy) {
        this.totalCacheBlocks = totalCacheBlocks;
        this.ways = ways;
        this.policy = policy;
        this.timer = 0;
        this.sets = Math.floor(totalCacheBlocks / ways);
        
        this.cache = Array.from({ length: this.sets }, () => 
            Array.from({ length: this.ways }, () => new CacheLine())
        );
        this.seenBlocks = new Set();
    }

    access(block, operation, res, writePolicy) {
        this.timer++;
        let setIndex = block % this.sets;

        // HIT
        for (let i = 0; i < this.ways; i++) {
            if (this.cache[setIndex][i].valid && this.cache[setIndex][i].block === block) {
                this.cache[setIndex][i].lastUsed = this.timer;
                res.hits++;

                if (operation === 'W') {
                    if (writePolicy === "WRITE_THROUGH") {
                        res.memoryWrites++;
                    } else {
                        this.cache[setIndex][i].dirty = true;
                    }
                }
                return true;
            }
        }

        // MISS
        res.misses++;

        if (!this.seenBlocks.has(block)) {
            res.compulsory++;
            this.seenBlocks.add(block);
        } else {
            let empty = false;
            for (let line of this.cache[setIndex]) {
                if (!line.valid) {
                    empty = true;
                    break;
                }
            }
            if (empty) res.conflict++;
            else res.capacity++;
        }

        let replaceIndex = this.getReplacementIndex(setIndex);

        // Write-back dirty eviction
        if (this.cache[setIndex][replaceIndex].valid && 
            this.cache[setIndex][replaceIndex].dirty && 
            writePolicy === "WRITE_BACK") {
            res.memoryWrites++;
        }

        this.cache[setIndex][replaceIndex].block = block;
        this.cache[setIndex][replaceIndex].valid = true;
        this.cache[setIndex][replaceIndex].lastUsed = this.timer;
        this.cache[setIndex][replaceIndex].insertedTime = this.timer;

        if (operation === 'W') {
            if (writePolicy === "WRITE_THROUGH") {
                this.cache[setIndex][replaceIndex].dirty = false;
                res.memoryWrites++;
            } else {
                this.cache[setIndex][replaceIndex].dirty = true;
            }
        } else {
            this.cache[setIndex][replaceIndex].dirty = false;
        }

        return false;
    }

    getReplacementIndex(setIndex) {
        for (let i = 0; i < this.ways; i++) {
            if (!this.cache[setIndex][i].valid) return i;
        }

        if (this.policy === "LRU") {
            let idx = 0;
            for (let i = 1; i < this.ways; i++) {
                if (this.cache[setIndex][i].lastUsed < this.cache[setIndex][idx].lastUsed) {
                    idx = i;
                }
            }
            return idx;
        }

        if (this.policy === "FIFO") {
            let idx = 0;
            for (let i = 1; i < this.ways; i++) {
                if (this.cache[setIndex][i].insertedTime < this.cache[setIndex][idx].insertedTime) {
                    idx = i;
                }
            }
            return idx;
        }

        return Math.floor(Math.random() * this.ways);
    }
}

// Global State
let memorySequence = [];
let simulationResults = [];

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Form elements
const mappingTypeSelect = document.getElementById('mappingType');
const waysGroup = document.getElementById('waysGroup');
const waysInput = document.getElementById('ways');
const totalCacheBlocksInput = document.getElementById('totalCacheBlocks');
const writePolicySelect = document.getElementById('writePolicy');
const hitTimeInput = document.getElementById('hitTime');
const missPenaltyInput = document.getElementById('missPenalty');

// Sequence elements
const opTypeSelect = document.getElementById('opType');
const blockNumInput = document.getElementById('blockNum');
const addSeqBtn = document.getElementById('addSeqBtn');
const bulkInput = document.getElementById('bulkInput');
const bulkAddBtn = document.getElementById('bulkAddBtn');
const sequenceList = document.getElementById('sequenceList');
const clearSeqBtn = document.getElementById('clearSeqBtn');

// Actions and Results
const runSimBtn = document.getElementById('runSimBtn');
const simResultsSection = document.getElementById('simResults');
const comparisonTableBody = document.querySelector('#comparisonTable tbody');
const detailedResultsDiv = document.getElementById('detailedResults');
const searchBlockInput = document.getElementById('searchBlockInput');
const searchBlockBtn = document.getElementById('searchBlockBtn');
const searchBlockResult = document.getElementById('searchBlockResult');

// AMAT elements
const calcAmatBtn = document.getElementById('calcAmatBtn');
const amatResultsDiv = document.getElementById('amatResults');

// Event Listeners
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

mappingTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === "1") {
        waysGroup.style.display = 'block';
    } else {
        waysGroup.style.display = 'none';
    }
});

addSeqBtn.addEventListener('click', () => {
    const op = opTypeSelect.value;
    const block = parseInt(blockNumInput.value);
    if (!isNaN(block) && block >= 0) {
        addSequenceItem(op, block);
        blockNumInput.value = '';
        blockNumInput.focus();
    }
});

bulkAddBtn.addEventListener('click', () => {
    const val = bulkInput.value.trim();
    if (!val) return;
    const items = val.split(',').map(s => s.trim());
    items.forEach(item => {
        const op = item.charAt(0).toUpperCase();
        const block = parseInt(item.substring(1));
        if ((op === 'R' || op === 'W') && !isNaN(block)) {
            addSequenceItem(op, block);
        }
    });
    bulkInput.value = '';
});

clearSeqBtn.addEventListener('click', () => {
    memorySequence = [];
    renderSequence();
});

function addSequenceItem(op, block) {
    memorySequence.push({ op, block });
    renderSequence();
}

function renderSequence() {
    sequenceList.innerHTML = '';
    memorySequence.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'seq-item';
        li.innerHTML = `
            <span class="op ${item.op}">${item.op}</span>
            <span class="block">${item.block}</span>
            <span class="remove" data-index="${index}">&times;</span>
        `;
        sequenceList.appendChild(li);
    });

    document.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            memorySequence.splice(idx, 1);
            renderSequence();
        });
    });
}

runSimBtn.addEventListener('click', runSimulationController);

function runSimulationController() {
    if (memorySequence.length === 0) {
        alert("Please add memory access sequence first.");
        return;
    }

    const mappingType = parseInt(mappingTypeSelect.value);
    const totalCacheBlocks = parseInt(totalCacheBlocksInput.value);
    let ways = 1;

    if (mappingType === 0) ways = 1; // Direct
    else if (mappingType === 1) ways = parseInt(waysInput.value); // Set Associative
    else if (mappingType === 2) ways = totalCacheBlocks; // Fully

    if (totalCacheBlocks <= 0 || ways <= 0 || totalCacheBlocks % ways !== 0) {
        alert("Invalid input: cache blocks must be positive and divisible by ways");
        return;
    }

    const writePolicy = writePolicySelect.value;
    const hitTime = parseFloat(hitTimeInput.value);
    const missPenalty = parseFloat(missPenaltyInput.value);
    
    const policies = ["LRU", "FIFO", "Random"];
    simulationResults = [];

    policies.forEach(policy => {
        let sim = new CacheSimulator(totalCacheBlocks, ways, policy);
        let res = {
            policy, hits: 0, misses: 0, compulsory: 0, conflict: 0, capacity: 0, memoryWrites: 0
        };

        memorySequence.forEach(req => {
            sim.access(req.block, req.op, res, writePolicy);
        });

        let total = memorySequence.length;
        res.hitRatio = res.hits / total;
        res.missRatio = res.misses / total;
        res.AMAT_ns = hitTime + res.missRatio * missPenalty;
        // Deep copy final cache state for rendering
        res.finalCache = sim.cache.map(set => set.map(line => ({...line})));
        
        simulationResults.push(res);
    });

    renderResults();
}

function renderResults() {
    simResultsSection.classList.remove('hidden');
    simResultsSection.scrollIntoView({ behavior: 'smooth' });

    // Table
    comparisonTableBody.innerHTML = '';
    simulationResults.forEach(res => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${res.policy}</strong></td>
            <td>${res.hits}</td>
            <td>${res.misses}</td>
            <td>${(res.hitRatio * 100).toFixed(2)}%</td>
            <td>${(res.missRatio * 100).toFixed(2)}%</td>
            <td>${res.AMAT_ns.toFixed(2)}</td>
            <td>${res.memoryWrites}</td>
        `;
        comparisonTableBody.appendChild(tr);
    });

    // Detailed Views
    detailedResultsDiv.innerHTML = '';
    simulationResults.forEach(res => {
        const card = document.createElement('div');
        card.className = 'policy-card';
        card.innerHTML = `<h3>${res.policy} Policy - Cache State</h3>`;
        
        const visual = document.createElement('div');
        visual.className = 'cache-visual';

        res.finalCache.forEach((set, i) => {
            const setRow = document.createElement('div');
            setRow.className = 'cache-set';
            
            const label = document.createElement('div');
            label.className = 'set-label';
            label.textContent = `Set ${i}`;
            setRow.appendChild(label);

            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'cache-blocks';

            set.forEach(line => {
                const cell = document.createElement('div');
                cell.className = `block-cell ${line.valid ? 'valid' : ''} ${line.dirty ? 'dirty' : ''}`;
                cell.textContent = line.valid ? line.block : '-';
                blocksContainer.appendChild(cell);
            });

            setRow.appendChild(blocksContainer);
            visual.appendChild(setRow);
        });

        card.appendChild(visual);
        
        // Add Miss details
        const missDetails = document.createElement('p');
        missDetails.style.marginTop = '1rem';
        missDetails.style.fontSize = '0.9rem';
        missDetails.style.color = 'var(--text-secondary)';
        missDetails.innerHTML = `Miss Breakdown: <strong>${res.compulsory}</strong> Compulsory, <strong>${res.conflict}</strong> Conflict, <strong>${res.capacity}</strong> Capacity`;
        card.appendChild(missDetails);

        detailedResultsDiv.appendChild(card);
    });
}

searchBlockBtn.addEventListener('click', () => {
    const target = parseInt(searchBlockInput.value);
    if (isNaN(target)) return;

    if (simulationResults.length === 0) {
        searchBlockResult.textContent = "Run simulation first.";
        return;
    }

    let outputHtml = '';
    simulationResults.forEach(res => {
        let found = false;
        let setNum = -1;
        let lineNum = -1;
        let isDirty = false;

        for (let i = 0; i < res.finalCache.length; i++) {
            for (let j = 0; j < res.finalCache[i].length; j++) {
                if (res.finalCache[i][j].valid && res.finalCache[i][j].block === target) {
                    found = true;
                    setNum = i;
                    lineNum = j;
                    isDirty = res.finalCache[i][j].dirty;
                    break;
                }
            }
            if(found) break;
        }

        outputHtml += `<div style="margin-bottom:0.5rem"><strong>${res.policy}:</strong> `;
        if (found) {
            outputHtml += `<span style="color:var(--accent-green)">Found in Set ${setNum}, Line ${lineNum} ${isDirty ? '(Dirty)' : ''}</span>`;
        } else {
            outputHtml += `<span style="color:var(--accent-red)">Not present in cache</span>`;
        }
        outputHtml += `</div>`;
    });

    searchBlockResult.innerHTML = outputHtml;
});

// AMAT Calculation
calcAmatBtn.addEventListener('click', () => {
    const L1Time = parseFloat(document.getElementById('l1Time').value);
    const L2Time = parseFloat(document.getElementById('l2Time').value);
    const L3Time = parseFloat(document.getElementById('l3Time').value);
    const MemTime = parseFloat(document.getElementById('memTime').value);

    const L1Hit = parseFloat(document.getElementById('l1Hit').value) / 100.0;
    const L2Hit = parseFloat(document.getElementById('l2Hit').value) / 100.0;
    const L3Hit = parseFloat(document.getElementById('l3Hit').value) / 100.0;

    const L1Miss = 1 - L1Hit;
    const L2Miss = 1 - L2Hit;
    const L3Miss = 1 - L3Hit;

    const amat = L1Time + L1Miss * (L2Time + L2Miss * (L3Time + L3Miss * MemTime));

    document.getElementById('resL1Miss').textContent = (L1Miss * 100).toFixed(1) + '%';
    document.getElementById('resL2Miss').textContent = (L2Miss * 100).toFixed(1) + '%';
    document.getElementById('resL3Miss').textContent = (L3Miss * 100).toFixed(1) + '%';
    document.getElementById('resAmat').textContent = amat.toFixed(2) + ' ns';

    amatResultsDiv.classList.remove('hidden');
});
