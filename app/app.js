// Space Marine 2 Talent Calculator
class TalentCalculator {
    constructor() {
        this.data = null;
        this.currentClass = null;
        this.selectedPerks = new Map(); // columnId -> perkId
        this.selectedPrestige = new Set(); // perkId set
        this.maxPrestigePerks = 8;

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
            this.loadFromUrl();

            // If no URL data, select first class
            if (!this.currentClass && this.data.classes.length > 0) {
                this.selectClass(this.data.classes[0].id);
            }

        } catch (error) {
            console.error('Failed to initialize talent calculator:', error);
            this.showError('Failed to load talent data. Please refresh the page.');
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

        // Clear current selections for this class
        this.clearClassSelections();

        this.currentClass = classData;

        // Update active tab
        document.querySelectorAll('.class-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.classId === classId);
        });

        // Render perk tree and prestige perks
        this.renderPerkTree();
        this.renderPrestigePerks();

        // Update URL
        this.updateUrl();
    }

    clearClassSelections() {
        // Clear perk selections for current class only
        if (this.currentClass) {
            this.currentClass.sections.forEach(section => {
                section.columns.forEach(column => {
                    this.selectedPerks.delete(column.id);
                });
            });
        }

        // Clear prestige selections
        this.selectedPrestige.clear();
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

        this.currentClass.prestige.forEach((perk, index) => {
            const perkElement = this.createPrestigeTile(perk, index);
            this.elements.prestigeGrid.appendChild(perkElement);
        });
    }

    createPerkTile(perk, columnId, perkIndex) {
        const tile = document.createElement('div');
        tile.className = 'perk-tile';
        tile.dataset.perkId = perk.id;
        tile.dataset.columnId = columnId;
        tile.dataset.perkIndex = perkIndex;

        // Check if selected
        if (this.selectedPerks.get(columnId) === perk.id) {
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

    createPrestigeTile(perk, perkIndex) {
        const tile = document.createElement('div');
        tile.className = 'prestige-tile';
        tile.dataset.perkId = perk.id;
        tile.dataset.perkIndex = perkIndex;

        // Check if selected
        if (this.selectedPrestige.has(perk.id)) {
            tile.classList.add('selected');
        }

        // Check if should be disabled (max prestige reached and not selected)
        if (this.selectedPrestige.size >= this.maxPrestigePerks && !this.selectedPrestige.has(perk.id)) {
            tile.classList.add('disabled');
        }

        // Icon (using text for Roman numerals)
        const icon = document.createElement('div');
        icon.className = 'prestige-icon';

        // Convert perk index to Roman numeral for display
        const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
        icon.textContent = romanNumerals[perkIndex] || (perkIndex + 1).toString();

        tile.appendChild(icon);

        // Events
        tile.addEventListener('click', () => this.togglePrestigePerk(perk.id, perkIndex));
        tile.addEventListener('mouseenter', () => this.showTooltip(`Mastery ${perk.name}`, perk.desc));
        tile.addEventListener('mouseleave', () => this.hideTooltip());

        return tile;
    }

    togglePerk(columnId, perkId, perkIndex) {
        const currentSelection = this.selectedPerks.get(columnId);

        if (currentSelection === perkId) {
            // Deselect
            this.selectedPerks.delete(columnId);
        } else {
            // Select (auto-deselects previous in column)
            this.selectedPerks.set(columnId, perkId);
        }

        // Re-render to update visual state
        this.renderPerkTree();
        this.updateUrl();
    }

    togglePrestigePerk(perkId, perkIndex) {
        if (this.selectedPrestige.has(perkId)) {
            // Deselect
            this.selectedPrestige.delete(perkId);
        } else {
            // Select if under limit
            if (this.selectedPrestige.size < this.maxPrestigePerks) {
                this.selectedPrestige.add(perkId);
            }
        }

        // Re-render to update visual state
        this.renderPrestigePerks();
        this.updateUrl();
    }

    resetClass() {
        if (!this.currentClass) return;

        this.clearClassSelections();
        this.renderPerkTree();
        this.renderPrestigePerks();
        this.updateUrl();
    }

    resetAll() {
        this.selectedPerks.clear();
        this.selectedPrestige.clear();

        if (this.currentClass) {
            this.renderPerkTree();
            this.renderPrestigePerks();
        }

        this.updateUrl();
    }

    // URL Encoding/Decoding
    encodeBuild() {
        if (!this.currentClass) return '';

        const version = 1;
        const classId = this.currentClass.id;

        // Calculate total columns across all sections
        let totalColumns = 0;
        this.currentClass.sections.forEach(section => {
            totalColumns += section.columns.length;
        });

        // Create nibbles array (4 bits per column)
        const nibbles = [];
        this.currentClass.sections.forEach(section => {
            section.columns.forEach(column => {
                const selectedPerkId = this.selectedPerks.get(column.id);
                if (selectedPerkId) {
                    // Find index of selected perk in column
                    const perkIndex = column.perks.findIndex(p => p.id === selectedPerkId);
                    nibbles.push(perkIndex + 1); // 1-based index (0 = none selected)
                } else {
                    nibbles.push(0); // No selection
                }
            });
        });

        // Pack nibbles into bytes (2 nibbles per byte)
        const bytes = [];
        for (let i = 0; i < nibbles.length; i += 2) {
            const high = nibbles[i] || 0;
            const low = nibbles[i + 1] || 0;
            bytes.push((high << 4) | low);
        }

        // Add prestige nibble (4 bits for 4 prestige perks)
        let prestigeNibble = 0;
        this.currentClass.prestige.forEach((perk, index) => {
            if (this.selectedPrestige.has(perk.id)) {
                prestigeNibble |= (1 << index);
            }
        });

        // If we have an odd number of nibbles, pack the prestige with a 0 nibble
        if (nibbles.length % 2 === 1) {
            bytes.push((prestigeNibble << 4)); // Prestige in high nibble, 0 in low
        } else {
            // Add as separate nibble pair
            bytes.push(prestigeNibble);
        }

        // Convert to base64url
        const payload = this.bytesToBase64Url(new Uint8Array(bytes));

        return `${version}.${classId}.${payload}`;
    }

    decodeBuild(buildString) {
        try {
            const parts = buildString.split('.');
            if (parts.length !== 3) return null;

            const [versionStr, classId, payload] = parts;
            const version = parseInt(versionStr);

            if (version !== 1) {
                console.warn('Unsupported build version:', version);
                return null;
            }

            // Find class
            const classData = this.data.classes.find(c => c.id === classId);
            if (!classData) {
                console.warn('Unknown class:', classId);
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

            // Apply perk selections
            const selectedPerks = new Map();
            let nibbleIndex = 0;

            classData.sections.forEach(section => {
                section.columns.forEach(column => {
                    if (nibbleIndex < nibbles.length) {
                        const perkIndex = nibbles[nibbleIndex];
                        if (perkIndex > 0 && perkIndex <= column.perks.length) {
                            const perk = column.perks[perkIndex - 1]; // Convert back to 0-based
                            selectedPerks.set(column.id, perk.id);
                        }
                    }
                    nibbleIndex++;
                });
            });

            // Apply prestige selections (from remaining nibbles)
            const selectedPrestige = new Set();
            if (nibbleIndex < nibbles.length) {
                const prestigeNibble = nibbles[nibbleIndex];
                classData.prestige.forEach((perk, index) => {
                    if (prestigeNibble & (1 << index)) {
                        selectedPrestige.add(perk.id);
                    }
                });
            }

            return {
                classId,
                selectedPerks,
                selectedPrestige
            };

        } catch (error) {
            console.error('Failed to decode build:', error);
            return null;
        }
    }

    bytesToBase64Url(bytes) {
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    base64UrlToBytes(str) {
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
        const buildString = this.encodeBuild();
        const url = new URL(window.location);

        if (buildString) {
            url.searchParams.set('b', buildString);
        } else {
            url.searchParams.delete('b');
        }

        window.history.replaceState({}, '', url);
    }

    loadFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const buildString = urlParams.get('b');

        if (buildString) {
            const buildData = this.decodeBuild(buildString);
            if (buildData) {
                this.selectedPerks = buildData.selectedPerks;
                this.selectedPrestige = buildData.selectedPrestige;
                this.selectClass(buildData.classId);
                return true;
            }
        }

        return false;
    }

    // UI Methods
    showShareModal() {
        const buildString = this.encodeBuild();
        const url = new URL(window.location);
        url.searchParams.set('b', buildString);

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
        const buildString = this.encodeBuild();
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
    new TalentCalculator();
});