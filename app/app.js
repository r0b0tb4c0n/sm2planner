// Space Marine 2 Build Planner
class BuildPlanner {
    constructor() {
        this.data = null;
        this.currentClass = null;
        // Store selections across all classes using composite keys
        // Format: "classId:columnId" -> perkId
        this.selectedPerks = new Map();
        // Store prestige selections per class
        // Format: classId -> Set of perkIds
        this.selectedPrestige = new Map();
        this.maxPrestigePerks = 4;
        this.isLoadingFromUrl = false;
        
        // Class ID to byte mapping (0-5 for 6 classes)
        // Used for compact URL encoding in v2 format
        this.classToByteMap = {
            'assault': 0,
            'bulwark': 1,
            'vanguard': 2,
            'tactical': 3,
            'heavy': 4,
            'sniper': 5
        };
        // Reverse mapping for decoding
        this.byteToClassMap = Object.fromEntries(
            Object.entries(this.classToByteMap).map(([k, v]) => [v, k])
        );

        this.elements = {
            classTabs: document.getElementById('classTabs'),
            perkTree: document.getElementById('perkTree'),
            prestigePerks: document.getElementById('prestigePerks'),
            prestigeGrid: document.getElementById('prestigeGrid'),
            shareBtn: document.getElementById('shareBtn'),
            resetClassBtn: document.getElementById('resetClassBtn'),
            resetAllBtn: document.getElementById('resetAllBtn'),
            shareModal: document.getElementById('shareModal'),
            modalClose: document.getElementById('modalClose'),
            shareUrl: document.getElementById('shareUrl'),
            copyUrlBtn: document.getElementById('copyUrlBtn'),
            tooltip: document.getElementById('tooltip'),
            reportIssueBtn: document.getElementById('reportIssueBtn'),
            reportIssueModal: document.getElementById('reportIssueModal'),
            reportModalClose: document.getElementById('reportModalClose'),
            reportIssueForm: document.getElementById('reportIssueForm'),
            cancelReportBtn: document.getElementById('cancelReportBtn'),
            reportStatus: document.getElementById('reportStatus')
        };

        // Hide report button if webhook is not configured
        if (this.elements.reportIssueBtn && !window.APP_CONFIG?.showReportButton) {
            this.elements.reportIssueBtn.style.display = 'none';
        }

        this.init();
    }

    async init() {
        try {
            // Load data from separate class files
            await this.loadClassData();

            // Setup event listeners
            this.setupEventListeners();

            // Render class tabs
            this.renderClassTabs();

            // Load from URL if present
            const loadedFromUrl = this.loadFromUrl();

            // If no URL data, select first class
            if (!loadedFromUrl && this.data.classes.length > 0) {
                this.selectClass(this.data.classes[0].id);
            }

        } catch (error) {
            console.error('Failed to initialize perk planner:', error);
            this.showError('Failed to load perk data. Please refresh the page.');
        }
    }

    async loadClassData() {
        // List of available classes
        const classFiles = ['assault', 'bulwark', 'vanguard', 'tactical', 'heavy', 'sniper'];
        const classes = [];

        // Load each class file
        for (const className of classFiles) {
            try {
                const response = await fetch(`data/${className}.json`);
                const classData = await response.json();
                classes.push(classData);
            } catch (error) {
                console.warn(`Failed to load ${className} class data:`, error);
            }
        }

        // Structure data in the expected format
        this.data = { classes };
    }

    setupEventListeners() {
        // Button events
        this.elements.shareBtn.addEventListener('click', () => this.showShareModal());
        this.elements.resetClassBtn.addEventListener('click', () => this.resetClass());
        this.elements.resetAllBtn.addEventListener('click', () => this.resetAll());
        this.elements.modalClose.addEventListener('click', () => this.hideShareModal());
        this.elements.copyUrlBtn.addEventListener('click', () => this.copyUrl());

        // Report issue events
        this.elements.reportIssueBtn.addEventListener('click', () => this.showReportModal());
        this.elements.reportModalClose.addEventListener('click', () => this.hideReportModal());
        this.elements.cancelReportBtn.addEventListener('click', () => this.hideReportModal());
        this.elements.reportIssueForm.addEventListener('submit', (e) => this.handleReportSubmit(e));

        // Modal close on background click
        this.elements.shareModal.addEventListener('click', (e) => {
            if (e.target === this.elements.shareModal) {
                this.hideShareModal();
            }
        });

        this.elements.reportIssueModal.addEventListener('click', (e) => {
            if (e.target === this.elements.reportIssueModal) {
                this.hideReportModal();
            }
        });

        // Tooltip events
        document.addEventListener('mousemove', (e) => this.updateTooltipPosition(e));

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideTooltip();
                this.hideShareModal();
                this.hideReportModal();
            }
        });
    }

    renderClassTabs() {
        this.elements.classTabs.innerHTML = '';

        this.data.classes.forEach(classData => {
            const tab = document.createElement('div');
            tab.className = 'class-tab';
            tab.dataset.classId = classData.id;

            // Create icon (using actual image if available, fallback to first letter)
            const icon = document.createElement('div');
            icon.className = 'class-tab-icon';

            if (classData.icon) {
                const img = document.createElement('img');
                img.src = classData.icon;
                img.alt = classData.name;
                img.onerror = () => {
                    // Fallback to first letter if image fails to load
                    icon.innerHTML = '';
                    icon.textContent = classData.name.charAt(0);
                };
                icon.appendChild(img);
            } else {
                // Use first letter as fallback
                icon.textContent = classData.name.charAt(0);
            }

            // Create name
            const name = document.createElement('div');
            name.className = 'class-tab-name';
            name.textContent = classData.name;

            tab.appendChild(icon);
            tab.appendChild(name);

            tab.addEventListener('click', () => this.selectClass(classData.id));

            this.elements.classTabs.appendChild(tab);
        });
    }

    selectClass(classId) {
        const classData = this.data.classes.find(c => c.id === classId);
        if (!classData) return;
 
        this.currentClass = classData;

        // Update active tab
        document.querySelectorAll('.class-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.classId === classId);
        });

        // Render perk tree and prestige perks
        this.renderPerkTree();
        this.renderPrestigePerks();

        // Only update URL if not loading from URL
        if (!this.isLoadingFromUrl) {
            this.updateUrl();
        }
    }

    clearClassSelections() {
        // Clear perk selections for current class only
        if (this.currentClass) {
            this.currentClass.sections.forEach(section => {
                section.columns.forEach(column => {
                    // Use composite key format: "classId:columnId"
                    const key = `${this.currentClass.id}:${column.id}`;
                    this.selectedPerks.delete(key);
                });
            });
            
            // Clear prestige selections for current class
            this.selectedPrestige.delete(this.currentClass.id);
        }
    }

    renderPerkTree() {
        const sectionsContainer = this.elements.perkTree.querySelector('.sections');
        sectionsContainer.innerHTML = '';

        this.currentClass.sections.forEach(section => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'section';
            sectionElement.setAttribute('data-section-id', section.id);

            // Section title
            const title = document.createElement('h2');
            title.className = 'section-title';
            title.textContent = section.name;
            sectionElement.appendChild(title);

            // Section columns
            const columnsContainer = document.createElement('div');
            columnsContainer.className = 'section-columns';

            section.columns.forEach(column => {
                const columnElement = document.createElement('div');
                columnElement.className = 'column';

                // Column title (optional)
                if (column.name) {
                    const columnTitle = document.createElement('div');
                    columnTitle.className = 'column-title';
                    columnTitle.textContent = column.name;
                    columnElement.appendChild(columnTitle);
                }

                // Perks in column
                column.perks.forEach((perk, index) => {
                    const perkElement = this.createPerkTile(perk, column.id, index);
                    columnElement.appendChild(perkElement);
                });

                columnsContainer.appendChild(columnElement);
            });

            sectionElement.appendChild(columnsContainer);
            sectionsContainer.appendChild(sectionElement);
        });
    }

    renderPrestigePerks() {
        this.elements.prestigeGrid.innerHTML = '';

        // Get prestige selections for current class
        const currentPrestige = this.selectedPrestige.get(this.currentClass.id) || new Set();

        this.currentClass.prestige.forEach((perk, index) => {
            const perkElement = this.createPrestigeTile(perk, index, currentPrestige);
            this.elements.prestigeGrid.appendChild(perkElement);
        });
    }

    createPerkTile(perk, columnId, perkIndex) {
        const tile = document.createElement('div');
        tile.className = 'perk-tile';
        tile.dataset.perkId = perk.id;
        tile.dataset.columnId = columnId;
        tile.dataset.perkIndex = perkIndex;

        // Check if selected using composite key
        const key = `${this.currentClass.id}:${columnId}`;
        if (this.selectedPerks.get(key) === perk.id) {
            tile.classList.add('selected');
        }

        // Icon (using actual image)
        const icon = document.createElement('div');
        icon.className = 'perk-icon';

        // Try to load the image, fallback to first letter if image fails
        const img = document.createElement('img');
        img.src = perk.img;
        img.alt = perk.name;
        img.onerror = () => {
            // Fallback to text if image fails to load
            icon.innerHTML = '';
            icon.textContent = perk.name.charAt(0);
        };
        icon.appendChild(img);

        tile.appendChild(icon);

        // Events
        tile.addEventListener('click', () => this.togglePerk(columnId, perk.id, perkIndex));
        tile.addEventListener('mouseenter', () => this.showTooltip(perk.name, perk.desc));
        tile.addEventListener('mouseleave', () => this.hideTooltip());

        return tile;
    }

    createPrestigeTile(perk, perkIndex, currentPrestige) {
        const tile = document.createElement('div');
        tile.className = 'prestige-tile';
        tile.dataset.perkId = perk.id;
        tile.dataset.perkIndex = perkIndex;

        // Check if selected
        if (currentPrestige.has(perk.id)) {
            tile.classList.add('selected');
        }

        // Check if should be disabled (max prestige reached and not selected)
        if (currentPrestige.size >= this.maxPrestigePerks && !currentPrestige.has(perk.id)) {
            tile.classList.add('disabled');
        }

        // Icon (using image instead of Roman numerals)
        const icon = document.createElement('div');
        icon.className = 'prestige-icon';

        const img = document.createElement('img');
        img.src = perk.img;
        img.alt = perk.name;
        img.onerror = () => {
            // Fallback to Roman numeral if image fails to load
            icon.innerHTML = '';
            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
            if (perkIndex < romanNumerals.length) {
                icon.textContent = romanNumerals[perkIndex];
            } else {
                // Fallback to number if beyond VII
                icon.textContent = (perkIndex + 1).toString();
            }
        };
        icon.appendChild(img);

        tile.appendChild(icon);

        // Events
        tile.addEventListener('click', () => this.togglePrestigePerk(perk.id, perkIndex));
        tile.addEventListener('mouseenter', () => this.showTooltip(`${perk.name}`, perk.desc));
        tile.addEventListener('mouseleave', () => this.hideTooltip());

        return tile;
    }

    togglePerk(columnId, perkId, perkIndex) {
        // Use composite key to track selections across all classes
        const key = `${this.currentClass.id}:${columnId}`;
        const currentSelection = this.selectedPerks.get(key);

        if (currentSelection === perkId) {
            // Deselect
            this.selectedPerks.delete(key);
        } else {
            // Select (auto-deselects previous in column)
            this.selectedPerks.set(key, perkId);
        }

        // Re-render to update visual state
        this.renderPerkTree();
        this.updateUrl();
    }

    togglePrestigePerk(perkId, perkIndex) {
        // Ensure prestige set exists for current class
        if (!this.selectedPrestige.has(this.currentClass.id)) {
            this.selectedPrestige.set(this.currentClass.id, new Set());
        }
        const currentPrestige = this.selectedPrestige.get(this.currentClass.id);

        if (currentPrestige.has(perkId)) {
            // Deselect
            currentPrestige.delete(perkId);
        } else {
            // Select if under limit
            if (currentPrestige.size < this.maxPrestigePerks) {
                currentPrestige.add(perkId);
            }
        }

        // Re-render to update visual state
        this.renderPrestigePerks();
        this.updateUrl();
    }

    resetClass() {
        if (!this.currentClass) return;

        // Clear selections for current class only
        this.clearClassSelections();
        this.renderPerkTree();
        this.renderPrestigePerks();
        this.updateUrl();
    }

    resetAll() {
        // Clear all selections across all classes
        this.selectedPerks.clear();
        this.selectedPrestige.clear();

        if (this.currentClass) {
            this.renderPerkTree();
            this.renderPrestigePerks();
        }

        this.updateUrl();
    }

    // URL Encoding/Decoding
    // Version 1 (Legacy): 1.classId.payload - Single class, long format
    // Version 2 (Current): 2.AXXXXXXXX;BXXXXXXXX - Multi-class, compact format
    //   Where A,B are class bytes (0-5) and XXXXXXXX is base64url encoded build data
    
    encodeAllBuilds() {
        // Encode all classes that have selections using v2 format
        // Used for the browser URL bar to maintain state across all classes
        const builds = [];

        this.data.classes.forEach(classData => {
            const classByte = this.classToByteMap[classData.id];
            if (classByte === undefined) return;

            // Check if this class has any selections
            const hasPerks = Array.from(this.selectedPerks.keys()).some(key => key.startsWith(`${classData.id}:`));
            const hasPrestige = this.selectedPrestige.has(classData.id) && this.selectedPrestige.get(classData.id).size > 0;

            if (!hasPerks && !hasPrestige) return;

            const buildData = this.encodeClassBuild(classData);
            if (buildData) {
                builds.push(`${classByte}${buildData}`);
            }
        });

        if (builds.length === 0) return '';

        // Version 2 format: 2.build1;build2;build3
        return `2.${builds.join(';')}`;
    }

    encodeCurrentBuild() {
        // Encode only the current class using v2 format
        // Used for the share modal to share a single class build
        if (!this.currentClass) return '';

        const classByte = this.classToByteMap[this.currentClass.id];
        if (classByte === undefined) return '';

        const buildData = this.encodeClassBuild(this.currentClass);
        if (!buildData) return '';

        // Version 2 format: 2.Axxxxxxxx (single class)
        return `2.${classByte}${buildData}`;
    }

    encodeClassBuild(classData) {
        // Encode a single class's perk and prestige selections
        const nibbles = [];
        
        // Calculate total columns across all sections
        classData.sections.forEach(section => {
            section.columns.forEach(column => {
                const key = `${classData.id}:${column.id}`;
                const selectedPerkId = this.selectedPerks.get(key);
                if (selectedPerkId) {
                    // Find index of selected perk in column
                    const perkIndex = column.perks.findIndex(p => p.id === selectedPerkId);
                    nibbles.push(perkIndex + 1); // 1-based index (0 = none selected)
                } else {
                    nibbles.push(0); // No selection
                }
            });
        });

        // Pad nibbles to even count if needed
        if (nibbles.length % 2 === 1) {
            nibbles.push(0);
        }

        // Pack nibbles into bytes (2 nibbles per byte)
        const bytes = [];
        for (let i = 0; i < nibbles.length; i += 2) {
            const high = nibbles[i] || 0;
            const low = nibbles[i + 1] || 0;
            bytes.push((high << 4) | low);
        }

        // Add prestige byte (7 bits for 7 prestige perks)
        let prestigeByte = 0;
        const currentPrestige = this.selectedPrestige.get(classData.id) || new Set();
        classData.prestige.forEach((perk, index) => {
            if (currentPrestige.has(perk.id)) {
                prestigeByte |= (1 << index);
            }
        });

        // Always add prestige as a separate full byte
        bytes.push(prestigeByte);

        // Convert to base64url
        return this.bytesToBase64Url(new Uint8Array(bytes));
    }

    decodeBuilds(buildString) {
        // Decode builds from URL - supports both v1 and v2 formats
        try {
            const parts = buildString.split('.');
            if (parts.length < 2) return null;

            const version = parseInt(parts[0]);

            if (version === 1) {
                // Legacy v1 format: 1.classId.payload
                return this.decodeV1Build(buildString);
            } else if (version === 2) {
                // New v2 format: 2.AXXXXXXXX;BXXXXXXXX
                return this.decodeV2Builds(buildString);
            } else {
                console.warn('Unsupported build version:', version);
                return null;
            }

        } catch (error) {
            console.error('Failed to decode builds:', error);
            return null;
        }
    }

    decodeV1Build(buildString) {
        // Decode legacy v1 format: 1.classId.payload
        // Automatically upgrades to v2 format by converting to new data structure
        try {
            const parts = buildString.split('.');
            if (parts.length !== 3) return null;

            const [versionStr, classId, payload] = parts;

            // Find class
            const classData = this.data.classes.find(c => c.id === classId);
            if (!classData) {
                console.warn('Unknown class in v1 build:', classId);
                return null;
            }

            // Decode payload
            const bytes = this.base64UrlToBytes(payload);
            if (!bytes || bytes.length === 0) return null;

            // Decode nibbles from all bytes
            const nibbles = [];
            bytes.forEach(byte => {
                nibbles.push((byte >> 4) & 0xF); // High nibble
                nibbles.push(byte & 0xF);        // Low nibble
            });

            // Calculate expected nibbles for sections
            let expectedNibbles = 0;
            classData.sections.forEach(section => {
                expectedNibbles += section.columns.length;
            });

            // Apply perk selections using new composite key format
            const selectedPerks = new Map();
            let nibbleIndex = 0;

            classData.sections.forEach(section => {
                section.columns.forEach(column => {
                    if (nibbleIndex < nibbles.length) {
                        const perkIndex = nibbles[nibbleIndex];
                        if (perkIndex > 0 && perkIndex <= column.perks.length) {
                            const perk = column.perks[perkIndex - 1]; // Convert back to 0-based
                            const key = `${classId}:${column.id}`; // Use composite key for v2 compatibility
                            selectedPerks.set(key, perk.id);
                        }
                    }
                    nibbleIndex++;
                });
            });

            // Apply prestige selections (stored as separate byte after all nibble pairs)
            const selectedPrestige = new Map();
            const perkByteCount = Math.ceil(expectedNibbles / 2);
            if (bytes.length > perkByteCount) {
                const prestigeByte = bytes[perkByteCount];
                const prestigeSet = new Set();
                classData.prestige.forEach((perk, index) => {
                    if (prestigeByte & (1 << index)) {
                        prestigeSet.add(perk.id);
                    }
                });
                if (prestigeSet.size > 0) {
                    selectedPrestige.set(classId, prestigeSet);
                }
            }

            console.log('Upgraded v1 build to v2 format');

            return {
                classId,
                selectedPerks,
                selectedPrestige
            };

        } catch (error) {
            console.error('Failed to decode v1 build:', error);
            return null;
        }
    }

    decodeV2Builds(buildString) {
        // Decode v2 format: 2.AXXXXXXXX;BXXXXXXXX;CXXXXXXXX
        try {
            const parts = buildString.split('.');
            if (parts.length !== 2) return null;

            const [versionStr, buildsData] = parts;
            const builds = buildsData.split(';');
            
            const allSelectedPerks = new Map();
            const allSelectedPrestige = new Map();
            let lastClassId = null;

            for (const build of builds) {
                if (!build || build.length < 2) continue;

                // First character is the class byte (0-5)
                const classByte = parseInt(build.charAt(0));
                const classId = this.byteToClassMap[classByte];
                
                if (!classId) {
                    console.warn('Unknown class byte:', classByte);
                    continue;
                }

                lastClassId = classId;
                const payload = build.substring(1);

                const classData = this.data.classes.find(c => c.id === classId);
                if (!classData) continue;

                const bytes = this.base64UrlToBytes(payload);
                if (!bytes || bytes.length === 0) continue;

                // Decode nibbles from all bytes
                const nibbles = [];
                bytes.forEach(byte => {
                    nibbles.push((byte >> 4) & 0xF); // High nibble
                    nibbles.push(byte & 0xF);        // Low nibble
                });

                // Calculate expected nibbles for sections
                let expectedNibbles = 0;
                classData.sections.forEach(section => {
                    expectedNibbles += section.columns.length;
                });

                // Apply perk selections
                let nibbleIndex = 0;
                classData.sections.forEach(section => {
                    section.columns.forEach(column => {
                        if (nibbleIndex < nibbles.length) {
                            const perkIndex = nibbles[nibbleIndex];
                            if (perkIndex > 0 && perkIndex <= column.perks.length) {
                                const perk = column.perks[perkIndex - 1]; // Convert back to 0-based
                                const key = `${classId}:${column.id}`;
                                allSelectedPerks.set(key, perk.id);
                            }
                        }
                        nibbleIndex++;
                    });
                });

                // Apply prestige selections (stored as separate byte after all nibble pairs)
                const perkByteCount = Math.ceil(expectedNibbles / 2);
                if (bytes.length > perkByteCount) {
                    const prestigeByte = bytes[perkByteCount];
                    const prestigeSet = new Set();
                    classData.prestige.forEach((perk, index) => {
                        if (prestigeByte & (1 << index)) {
                            prestigeSet.add(perk.id);
                        }
                    });
                    if (prestigeSet.size > 0) {
                        allSelectedPrestige.set(classId, prestigeSet);
                    }
                }
            }

            return {
                classId: lastClassId, // Use the last class from the URL
                selectedPerks: allSelectedPerks,
                selectedPrestige: allSelectedPrestige
            };

        } catch (error) {
            console.error('Failed to decode v2 builds:', error);
            return null;
        }
    }

    bytesToBase64Url(bytes) {
        // Convert byte array to base64url encoding
        // base64url uses '-' and '_' instead of '+' and '/' and removes padding '='
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    base64UrlToBytes(str) {
        // Convert base64url string back to byte array
        try {
            // Convert base64url to base64
            const base64 = str
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            // Add padding if needed
            const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);

            // Decode
            const binary = atob(padded);
            return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
        } catch (error) {
            console.error('Failed to decode base64url:', error);
            return null;
        }
    }

    updateUrl() {
        // Update browser URL with all class builds using v2 format
        // This maintains state when refreshing or sharing the full URL
        // V1 URLs are automatically upgraded to v2 when any change is made
        const buildString = this.encodeAllBuilds();
        const url = new URL(window.location);

        if (buildString) {
            url.searchParams.set('b', buildString);
        } else {
            url.searchParams.delete('b');
        }

        window.history.replaceState({}, '', url);
    }

    loadFromUrl() {
        // Load build data from URL parameter
        // Supports both v1 (legacy) and v2 (current) formats
        // V1 URLs are automatically upgraded to v2 format
        const urlParams = new URLSearchParams(window.location.search);
        const buildString = urlParams.get('b');

        if (buildString) {
            const buildData = this.decodeBuilds(buildString);
            if (buildData) {
                this.isLoadingFromUrl = true;

                this.selectedPerks = buildData.selectedPerks;
                this.selectedPrestige = buildData.selectedPrestige;

                // Select the class from the URL, or first class with data
                const classToSelect = buildData.classId || this.data.classes[0].id;
                this.selectClass(classToSelect);

                this.isLoadingFromUrl = false;

                // Auto-upgrade v1 URLs to v2 format in the browser
                if (buildString.startsWith('1.')) {
                    console.log('Auto-upgrading URL from v1 to v2 format');
                    this.updateUrl();
                }

                return true;
            }
        }

        return false;
    }

    // UI Methods
    showShareModal() {
        // Generate shareable URL with only the current class build using v2 format
        const buildString = this.encodeCurrentBuild();
        const url = new URL(window.location);
        
        if (buildString) {
            url.searchParams.set('b', buildString);
        } else {
            url.searchParams.delete('b');
        }

        this.elements.shareUrl.value = url.toString();
        this.elements.shareModal.classList.add('show');
    }

    hideShareModal() {
        this.elements.shareModal.classList.remove('show');
    }

    async copyUrl() {
        try {
            await navigator.clipboard.writeText(this.elements.shareUrl.value);

            // Visual feedback
            const originalText = this.elements.copyUrlBtn.textContent;
            this.elements.copyUrlBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.elements.copyUrlBtn.textContent = originalText;
            }, 2000);

        } catch (error) {
            console.error('Failed to copy URL:', error);
            // Fallback: select text
            this.elements.shareUrl.select();
            this.elements.shareUrl.setSelectionRange(0, 99999);
        }
    }

    showTooltip(title, description) {
        const tooltip = this.elements.tooltip;
        const titleElement = tooltip.querySelector('.tooltip-title');
        const descElement = tooltip.querySelector('.tooltip-description');

        titleElement.textContent = title;
        descElement.textContent = description;

        tooltip.classList.add('show');
    }

    hideTooltip() {
        this.elements.tooltip.classList.remove('show');
    }

    updateTooltipPosition(e) {
        const tooltip = this.elements.tooltip;
        if (!tooltip.classList.contains('show')) return;

        const rect = tooltip.getBoundingClientRect();
        const x = e.clientX + 15;
        const y = e.clientY - rect.height - 15;

        // Keep tooltip in viewport
        const adjustedX = Math.min(x, window.innerWidth - rect.width - 15);
        const adjustedY = Math.max(y, 15);

        tooltip.style.left = adjustedX + 'px';
        tooltip.style.top = adjustedY + 'px';
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper modal
        alert(message);
    }

    // Report Issue Modal Methods
    showReportModal() {
        this.elements.reportIssueModal.classList.add('show');
        // Clear previous form data and status
        this.elements.reportIssueForm.reset();
        this.elements.reportStatus.style.display = 'none';
    }

    hideReportModal() {
        this.elements.reportIssueModal.classList.remove('show');
    }

    async handleReportSubmit(e) {
        e.preventDefault();

        const formData = new FormData(this.elements.reportIssueForm);
        const issueDescription = formData.get('issueDescription').trim();
        const contactName = formData.get('contactName').trim();
        const contactPlatform = formData.get('contactPlatform').trim();

        if (!issueDescription) {
            this.showReportStatus('Please provide an issue description.', 'error');
            return;
        }

        // Disable form while submitting
        const submitBtn = document.getElementById('submitReportBtn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            await this.submitIssueReport(issueDescription, contactName, contactPlatform);
            this.showReportStatus('Issue reported successfully! Thank you for your feedback.', 'success');

            // Clear form after successful submission
            setTimeout(() => {
                this.hideReportModal();
            }, 2000);

        } catch (error) {
            console.error('Failed to submit issue report:', error);
            this.showReportStatus('Failed to submit report. Please try again later.', 'error');
        } finally {
            // Re-enable form
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async submitIssueReport(description, contactName, contactPlatform) {
        // Use backend endpoint instead of direct Discord webhook
        const buildString = this.encodeAllBuilds();
        const currentUrl = window.location.href;

        let buildContext = '';
        if (buildString && this.currentClass) {
            buildContext = `Class: ${this.currentClass.name}\nBuild: ${currentUrl}`;
        }

        const payload = {
            description,
            contactName,
            contactPlatform,
            buildContext
        };

        const response = await fetch('/api/report-issue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }
    }

    showReportStatus(message, type) {
        const statusElement = this.elements.reportStatus;
        statusElement.textContent = message;
        statusElement.className = `report-status ${type}`;
        statusElement.style.display = 'block';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new BuildPlanner();
});