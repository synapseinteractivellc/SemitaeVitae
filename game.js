// Import the Character class from the updated file
import { Character } from './js/models/Character.js';
import { TaskManager } from './js/managers/TaskManager.js';
import { UpgradeManager } from './js/managers/UpgradeManager.js';

class Game {
    constructor() {
        this.player = null;
        this.initialized = false;
        this.resourceDefinitions = [];
        this.taskDefinitions = [];
        this.upgradeDefinitions = [];
        this.taskManager = null;
        this.upgradeManager = null;
        
        // For tracking UI state
        this.lastTaskCount = 0;
        this.lastUpgradeCount = 0;
        this.lastPanelRefreshTime = 0;
        
        // Game tick settings
        this.tickRate = 100; // Update every 100ms for smooth animations
        this.gameTickInterval = null;
        this.lastTick = null;
       
        // Get DOM elements
        this.welcomePage = document.getElementById('welcome-page');
        this.gamePage = document.getElementById('game-page');
        this.newGameForm = document.querySelector('.new-game-form');
        this.nameInput = document.querySelector('.name-input');
        this.resourcePanel = document.getElementById('resource-panel');
        this.statsPanel = document.getElementById('stats-panel');
        this.gamePanel = document.getElementById('game-panel');
        this.actionLog = document.getElementById('action-log');
        
        // Initialize event listeners
        this.initEventListeners();
    }
    
    /**
     * Initialize event listeners for the game
     */
    initEventListeners() {
        // Add event listener for form submission
        if (this.newGameForm) {
            this.newGameForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleStartGame();
            });
        }

        // Add event listeners for save and wipe buttons
        const saveButton = document.getElementById('save-button');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveGame();
                this.addToActionLog('Game saved.');
            });
        }

        const wipeButton = document.getElementById('wipe-button');
        if (wipeButton) {
            wipeButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to wipe all saved data? This cannot be undone.')) {
                    localStorage.removeItem('semitaeVitae_player');
                    this.addToActionLog('Game data wiped.');
                    location.reload(); // Reload the page to start fresh
                }
            });
        }
    }
    
    /**
     * Handle the start game button click
     */
    handleStartGame() {
        const playerName = this.nameInput ? this.nameInput.value.trim() : 'Player';
        
        // Validate player name
        if (!playerName) {
            alert('Please enter your name before entering the city.');
            return;
        }
        
        // Load game data first
        this.loadGameData().then(() => {
            // Create a new character
            this.createNewCharacter(playerName);
            
            // Transition to game page
            this.showGamePage();
            
            // Initialize game systems
            this.initGame();
        });
    }
    
    /**
     * Load all game data from JSON files
     */
    async loadGameData() {
        try {
            // Load resources
            const resourceResponse = await fetch('./data/resources.json');
            this.resourceDefinitions = await resourceResponse.json();
            
            // Load tasks
            const taskResponse = await fetch('./data/tasks.json');
            this.taskDefinitions = await taskResponse.json();
            
            // Load classes
            try {
                const classesResponse = await fetch('./data/classes.json');
                this.classDefinitions = await classesResponse.json();
            } catch (error) {
                console.log('Classes data not available:', error);
                this.classDefinitions = [];
            }
            
            // Load skills
            try {
                const skillsResponse = await fetch('./data/skills.json');
                this.skillDefinitions = await skillsResponse.json();
            } catch (error) {
                console.log('Skills data not available:', error);
                this.skillDefinitions = [];
            }
            
            // Load upgrades
            try {
                const upgradeResponse = await fetch('./data/upgrades.json');
                this.upgradeDefinitions = await upgradeResponse.json();
            } catch (error) {
                console.log('Upgrades data not available:', error);
                this.upgradeDefinitions = [];
            }
            
            console.log('Game data loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading game data:', error);
            return false;
        }
    }
    
    /**
     * Create a new character with initial resources
     * @param {string} name - Character name
     */
    createNewCharacter(name) {
        // Create a new character instance
        this.player = new Character({
            name: name
        });
        
        // Initialize resources from definitions
        this.resourceDefinitions.forEach(resourceDef => {
            this.player.initResource(resourceDef);
        });

        // Ensure hp and stamina are unlocked and initialized
        if (this.player.resources['hp']) {
            this.player.resources['hp'].locked = false;
            this.player.resources['hp'].value = this.player.resources['hp'].max;
        }
        
        if (this.player.resources['stamina']) {
            this.player.resources['stamina'].locked = false;
            this.player.resources['stamina'].value = this.player.resources['stamina'].max;
        }
        
        // Save character to local storage
        this.saveGame();
        
        console.log(`Created new character: ${name}`);
    }
    
    /**
     * Show the game page and hide welcome page
     */
    showGamePage() {
        // Hide welcome page and show game page
        if (this.welcomePage) {
            this.welcomePage.style.display = 'none';
        }
        if (this.gamePage) {
            this.gamePage.style.display = 'flex';
        }
    }
    
    /**
     * Initialize the game systems
     */
    initGame() {
        if (this.initialized) return;

        // Initialize managers
        this.taskManager = new TaskManager(this);
        this.upgradeManager = new UpgradeManager(this);

        // Initialize UI panels
        this.initResourcePanel();
        this.initStatsPanel();
        this.initGamePanel();
        
        // Start the game tick
        this.startGameTick();
        
        this.initialized = true;
        console.log('Game initialized');
    }
    
    /**
     * Initialize the resource panel
     */
    initResourcePanel() {
        if (!this.resourcePanel) return;

        // Get all resource groups
        const groups = [...new Set(
            this.player.getUnlockedResources()
                .filter(r => r.sortOrder < 705)
                .map(r => r.group)
        )];
        
        let html = '<h3>Resources</h3>';
        
        // Generate HTML for each group
        groups.forEach(group => {
            const groupResources = this.player.getResourcesByGroup(group)
                .filter(r => !r.locked && r.sortOrder < 705);
            
            if (groupResources.length === 0) return;
            
            // Create collapsible group
            html += `
                <div class="resource-group">
                    <div class="group-header" data-group="${group}">
                        <span class="collapse-icon">▼</span> ${this.capitalizeFirstLetter(group)}
                    </div>
                    <div class="group-content" id="group-${group}">
            `;
            
            // Add resources in this group
            groupResources.forEach(resource => {
                let resourceDisplayName = this.capitalizeFirstLetter(resource.name) || this.capitalizeFirstLetter(resource.id);
                html += `
                    <div class="resource" id="resource-${resource.id}">
                        <span class="resource-name" title="${resource.desc || ''}">${resourceDisplayName}:</span>
                        <span class="resource-value">${Math.floor(resource.value)}/${resource.max > 0 ? resource.max : '∞'}</span>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        this.resourcePanel.innerHTML = html;
        
        // Add event listeners for collapsible groups
        document.querySelectorAll('.group-header').forEach(header => {
            header.addEventListener('click', () => {
                const group = header.getAttribute('data-group');
                const content = document.getElementById(`group-${group}`);
                const icon = header.querySelector('.collapse-icon');
                
                if (content && icon) {
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        icon.textContent = '▼';
                    } else {
                        content.style.display = 'none';
                        icon.textContent = '►';
                    }
                }
            });
        });
    }
    
    /**
     * Initialize the stats panel
     */
    initStatsPanel() {
        if (!this.statsPanel) return;

        let html = '';
        
        // Add current action display
        html += `
            <div class="current-action">
                <span class="action-name">Current Task: Idle</span>
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
            </div>
        `;
        
        // Get all unlocked stat resources (sortOrder >= 705)
        const statResources = this.player.getUnlockedStatResources();
        
        // Add each stat resource as a progress bar
        statResources.forEach(resource => {
            const percentage = resource.max > 0 ? (resource.value / resource.max) * 100 : 0;
            const colorClass = this.getResourceColorClass(resource.id);
            let statName = this.capitalizeFirstLetter(resource.name) || this.capitalizeFirstLetter(resource.id);
            
            html += `
                <div class="stat-resource" id="stat-${resource.id}">
                    <div class="stat-row">
                        <span class="stat-name">${statName}:</span>
                        <div class="stat-bar-container">
                            <div class="stat-bar ${colorClass}" style="width: ${percentage}%"></div>
                            <span class="stat-value">${Math.floor(resource.value)}/${resource.max}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        this.statsPanel.innerHTML = html;
    }
    
    /**
     * Get the appropriate color class for a resource
     * @param {string} resourceId - Resource identifier
     * @returns {string} - CSS class for coloring
     */
    getResourceColorClass(resourceId) {
        switch (resourceId) {
            case 'hp': return 'resource-red';
            case 'stamina': return 'resource-green';
            case 'rage': return 'resource-orange';
            case 'focus': return 'resource-blue';
            case 'mana': return 'resource-purple';
            case 'air': return 'resource-cyan';
            case 'earth': return 'resource-brown';
            case 'fire': return 'resource-red';
            case 'water': return 'resource-blue';
            default: return '';
        }
    }
    
    /**
     * Check if game panel needs to be refreshed
     * @returns {boolean} - True if panel was refreshed
     */
    checkGamePanelRefresh() {
        // Safety check
        if (!this.initialized || !this.taskManager || !this.upgradeManager) {
            return false;
        }
        
        try {
            const availableTasks = this.getAvailableTasks();
            const availableUpgrades = this.upgradeManager.getAvailableUpgrades();
            
            // Check if we need to reinitialize the panel due to changes
            if (availableTasks.length !== this.lastTaskCount || 
                availableUpgrades.length !== this.lastUpgradeCount) {
                
                // Update our tracking values
                this.lastTaskCount = availableTasks.length;
                this.lastUpgradeCount = availableUpgrades.length;
                
                // Fully reinitialize the panel
                this.initGamePanel();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking for game panel refresh:', error);
            return false;
        }
    }
    
    /**
     * Initialize the game panel with task and upgrade buttons
     */
    initGamePanel() {
        if (!this.gamePanel || !this.initialized || !this.taskManager || !this.upgradeManager) return;

        let html = `<h2>Available Actions</h2>`;
        
        // Get available tasks and upgrades
        const availableTasks = this.getAvailableTasks();
        const availableUpgrades = this.upgradeManager.getAvailableUpgrades();
        
        // First display tasks section
        if (availableTasks.length > 0) {
            html += `<div class="section-title">Tasks</div>`;
            
            // Group tasks by their group property
            const taskGroups = this.groupItemsByProperty(availableTasks, 'group');
            
            // Generate HTML for each task group
            html += this.generateGroupsHTML(taskGroups, 'task');
        }
        
        // Then display upgrades section
        if (availableUpgrades.length > 0) {
            html += `<div class="section-title">Upgrades</div>`;
            
            // Group upgrades by their group property
            const upgradeGroups = this.groupItemsByProperty(availableUpgrades, 'group');
            
            // Generate HTML for each upgrade group
            html += this.generateGroupsHTML(upgradeGroups, 'upgrade');
        }
        
        // If no tasks or upgrades available
        if (availableTasks.length === 0 && availableUpgrades.length === 0) {
            html += `<p>No tasks or upgrades available. Grow your skills.</p>`;
        }
        
        this.gamePanel.innerHTML = html;
        
        // Add event listeners for task buttons
        document.querySelectorAll('.task-button').forEach(button => {
            button.addEventListener('click', () => {
                const taskId = button.getAttribute('data-item-id');
                if (taskId) {
                    this.startTask(taskId);
                }
            });
        });
        
        // Add event listeners for upgrade buttons
        document.querySelectorAll('.upgrade-button').forEach(button => {
            button.addEventListener('click', () => {
                const upgradeId = button.getAttribute('data-item-id');
                if (upgradeId) {
                    this.purchaseUpgrade(upgradeId);
                }
            });
        });
        
        // Add event listeners for collapsible groups
        document.querySelectorAll('.group-header').forEach(header => {
            header.addEventListener('click', () => {
                const group = header.getAttribute('data-group');
                const type = header.getAttribute('data-type');
                if (group && type) {
                    const content = document.getElementById(`${type}-group-${group}`);
                    const icon = header.querySelector('.collapse-icon');
                    
                    if (content && icon) {
                        if (content.style.display === 'none') {
                            content.style.display = 'block';
                            icon.textContent = '▼';
                        } else {
                            content.style.display = 'none';
                            icon.textContent = '►';
                        }
                    }
                }
            });
        });
    }
    
    /**
     * Generate HTML for groups of items (tasks or upgrades)
     * @param {Object} groups - Grouped items
     * @param {string} type - Type of items ('task' or 'upgrade')
     * @returns {string} - HTML for the groups
     */
    generateGroupsHTML(groups, type) {
        let html = '';
        
        // Generate HTML for each group
        Object.entries(groups).forEach(([group, items]) => {
            html += `
                <div class="item-group">
                    <div class="group-header" data-group="${group}" data-type="${type}">
                        <span class="collapse-icon">▼</span> ${this.capitalizeFirstLetter(group)}
                    </div>
                    <div class="group-content" id="${type}-group-${group}">
            `;
            
            // Add buttons for each item
            items.forEach(item => {
                let canExecute;
                let buttonClass;
                
                if (type === 'task' && this.taskManager) {
                    canExecute = this.taskManager.canStartTask(item);
                    buttonClass = canExecute ? 'task-button' : 'task-button disabled';
                } else if (type === 'upgrade' && this.upgradeManager) {
                    canExecute = this.upgradeManager.canPurchaseUpgrade(item);
                    buttonClass = canExecute ? 'upgrade-button' : 'upgrade-button disabled';
                } else {
                    canExecute = false;
                    buttonClass = type === 'task' ? 'task-button disabled' : 'upgrade-button disabled';
                }
                
                let itemDisplayName = this.capitalizeFirstLetter(item.name) || this.capitalizeFirstLetter(item.id);
                
                // Add cost info to tooltip
                let costInfo = '';
                if (item.cost) {
                    costInfo = 'Costs: ';
                    for (const [resourceId, amount] of Object.entries(item.cost)) {
                        costInfo += `${amount} ${resourceId}, `;
                    }
                    costInfo = costInfo.slice(0, -2); // Remove trailing comma and space
                }
                
                let tooltip = item.desc || '';
                if (costInfo) {
                    tooltip += (tooltip ? '\n' : '') + costInfo;
                }
                
                // For upgrades, show current level/max
                let levelBadge = '';
                if (type === 'upgrade' && this.upgradeManager) {
                    const currentLevel = this.upgradeManager.getUpgradeLevel(item.id);
                    if (currentLevel > 0) {
                        levelBadge = `<span class="upgrade-level">${currentLevel}/${item.max || 1}</span>`;
                    }
                }
                
                html += `
                    <button class="${buttonClass}" 
                            data-item-id="${item.id}" 
                            title="${tooltip}"
                            ${canExecute ? '' : 'disabled'}>
                        ${itemDisplayName}${levelBadge}
                    </button>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        return html;
    }
    
    /**
     * Update button states without rebuilding everything
     */
    updateButtonStates() {
        // Safety checks
        if (!this.initialized || !this.taskManager || !this.upgradeManager) {
            return;
        }
        
        try {
            // Update task button states
            document.querySelectorAll('.task-button').forEach(button => {
                const taskId = button.getAttribute('data-item-id');
                if (!taskId) return;
                
                const task = this.taskDefinitions.find(t => t.id === taskId);
                if (!task) return;
                
                const canExecute = this.taskManager.canStartTask(task);
                button.disabled = !canExecute;
                button.classList.toggle('disabled', !canExecute);
            });
            
            // Update upgrade button states
            document.querySelectorAll('.upgrade-button').forEach(button => {
                const upgradeId = button.getAttribute('data-item-id');
                if (!upgradeId) return;
                
                const upgrade = this.upgradeDefinitions.find(u => u.id === upgradeId);
                if (!upgrade) return;
                
                const canPurchase = this.upgradeManager.canPurchaseUpgrade(upgrade);
                button.disabled = !canPurchase;
                button.classList.toggle('disabled', !canPurchase);
                
                // Check if this upgrade is now maxed out
                const currentLevel = this.upgradeManager.getUpgradeLevel(upgradeId);
                if (upgrade.max && currentLevel >= upgrade.max) {
                    // Hide the button if upgrade is maxed out
                    button.style.display = 'none';
                }
                
                // Update level badge if present
                const levelBadge = button.querySelector('.upgrade-level');
                if (levelBadge && currentLevel > 0) {
                    levelBadge.textContent = `${currentLevel}/${upgrade.max || 1}`;
                }
            });
        } catch (error) {
            console.error('Error updating button states:', error);
        }
    }
    
    /**
     * Start a task by ID
     * @param {string} taskId - The task identifier
     */
    startTask(taskId) {
        if (this.taskManager) {
            this.taskManager.startTask(taskId);
        }
    }
    
    /**
     * Purchase an upgrade by ID
     * @param {string} upgradeId - The upgrade identifier
     */
    purchaseUpgrade(upgradeId) {
        if (this.upgradeManager) {
            const success = this.upgradeManager.purchaseUpgrade(upgradeId);
            
            if (success) {
                // Check if we need to reinitialize the panel due to maxed upgrade
                const upgrade = this.upgradeDefinitions.find(u => u.id === upgradeId);
                const currentLevel = this.upgradeManager.getUpgradeLevel(upgradeId);
                
                this.updateButtonStates();
                this.taskManager.updateTaskLockedStatus();
                if (upgrade && upgrade.max && currentLevel >= upgrade.max) {
                    // Schedule a check on the next update cycle
                    setTimeout(() => this.checkGamePanelRefresh(), 100);
                }
            }
        }
    }
    
    /**
     * Get all available tasks for the player
     * @returns {Array} - Array of available tasks
     */
    getAvailableTasks() {
        // First ensure task locked statuses are up to date
        if (this.taskManager) {
            this.taskManager.updateTaskLockedStatus();
        }
        
        // Then filter tasks that are not locked
        return this.taskDefinitions ? this.taskDefinitions.filter(task => task.locked !== true) : [];
    }
    
    /**
     * Group an array of objects by a property
     * @param {Array} array - Array to group
     * @param {string} property - Property to group by
     * @returns {Object} - Grouped object
     */
    groupItemsByProperty(array, property) {
        return array.reduce((grouped, item) => {
            const key = item[property] || 'misc';
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(item);
            return grouped;
        }, {});
    }
    
    /**
     * Update all UI elements
     */
    updateUI() {
        try {
            this.updateResourcePanel();
            this.updateStatsPanel();
            
            // Only check for panel refresh every 500ms
            const now = Date.now();
            if (!this.lastPanelRefreshTime || now - this.lastPanelRefreshTime > 500) {
                this.lastPanelRefreshTime = now;
                if (!this.checkGamePanelRefresh()) {
                    // If we didn't do a full refresh, just update button states
                    this.updateButtonStates();
                }
            } else {
                // Just update button states
                this.updateButtonStates();
            }
        } catch (error) {
            console.error('Error in updateUI:', error);
        }
    }
    
    /**
     * Update just the resource values in the resource panel
     */
    updateResourcePanel() {
        // Update each resource value display
        if (!this.player || !this.player.resources) return;
        
        Object.values(this.player.resources)
            .filter(r => !r.locked && r.sortOrder < 705)
            .forEach(resource => {
                const element = document.getElementById(`resource-${resource.id}`);
                if (element) {
                    const valueElement = element.querySelector('.resource-value');
                    if (valueElement) {
                        valueElement.textContent = `${Math.floor(resource.value)}/${resource.max > 0 ? resource.max : '∞'}`;
                    }
                }
            });
    }
    
    /**
     * Update the stats panel
     */
    updateStatsPanel() {
        if (!this.player) return;
        
        // Update current action progress
        const actionNameElement = document.querySelector('.action-name');
        const progressElement = document.querySelector('.progress');
        
        if (actionNameElement && progressElement && this.player.currentAction) {
            const task = this.player.currentAction;
            const progress = this.player.currentActionProgress * 100;
            let taskDisplayName = this.capitalizeFirstLetter(task.verb || task.name || task.id);
            
            actionNameElement.textContent = 'Current Task: ' + taskDisplayName;
            progressElement.style.width = `${progress}%`;
        } else if (actionNameElement && progressElement) {
            actionNameElement.textContent = 'Current Task: Idle';
            progressElement.style.width = '0%';
        }
        
        // Update stat resources
        if (this.player.getUnlockedStatResources) {
            this.player.getUnlockedStatResources().forEach(resource => {
                const element = document.getElementById(`stat-${resource.id}`);
                if (element) {
                    const barElement = element.querySelector('.stat-bar');
                    const valueElement = element.querySelector('.stat-value');
                    
                    if (barElement && valueElement) {
                        const percentage = resource.max > 0 ? (resource.value / resource.max) * 100 : 0;
                        barElement.style.width = `${percentage}%`;
                        valueElement.textContent = `${Math.floor(resource.value)}/${resource.max}`;
                    }
                }
            });
        }
    }
    
    /**
     * Start the game tick interval
     */
    startGameTick() {
        if (!this.gameTickInterval) {
            this.lastTick = Date.now();
            this.gameTickInterval = setInterval(() => this.updateGameTick(), this.tickRate);
        }
    }
    
    /**
     * Stop the game tick interval
     */
    stopGameTick() {
        if (this.gameTickInterval) {
            clearInterval(this.gameTickInterval);
            this.gameTickInterval = null;
        }
    }
    
    /**
     * Process a game tick
     */
    updateGameTick() {
        try {
            const now = Date.now();
            const deltaTime = now - (this.lastTick || now);
            this.lastTick = now;
            
            // Process task updates
            if (this.taskManager) {
                this.taskManager.processTick(deltaTime);
                this.taskManager.updateTaskLockedStatus();
            }
            
            // Update UI
            this.updateUI();
        } catch (error) {
            console.error('Error in game tick:', error);
        }
    }
    
    /**
     * Add a message to the action log
     * @param {string} message - Message to add
     */
    addToActionLog(message) {
        if (!this.actionLog) return;
        
        // Create container for log entries if it doesn't exist
        let logEntries = this.actionLog.querySelector('.log-entries');
        if (!logEntries) {
            this.actionLog.innerHTML = '<h3>Action Log</h3><div class="log-entries"></div>';
            logEntries = this.actionLog.querySelector('.log-entries');
        }
        
        const logEntry = document.createElement('p');
        logEntry.textContent = message;
        logEntries.appendChild(logEntry);
        
        // Auto-scroll to the bottom
        logEntries.scrollTop = logEntries.scrollHeight;
    }
    
    /**
     * Save game state to localStorage
     */
    saveGame() {
        if (!this.player) return;
        
        // Save game state to localStorage
        localStorage.setItem('semitaeVitae_player', JSON.stringify(this.player));
    }
    
    /**
     * Load game state from localStorage
     */
    loadGame() {
        // Load game state from localStorage
        const savedPlayer = localStorage.getItem('semitaeVitae_player');
        if (savedPlayer) {
            try {
                const playerData = JSON.parse(savedPlayer);
                this.player = new Character(playerData);
                return true;
            } catch (error) {
                console.error('Error loading saved game:', error);
                return false;
            }
        }
        return false;
    }
    
    /**
     * Helper function to capitalize the first letter of a string
     * @param {string} string - String to capitalize
     * @returns {string} - Capitalized string
     */
    capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}

// Initialize game when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Semitae Vitae...');
    
    // Create and initialize game instance
    window.game = new Game();
    
    // Check for saved game and load data
    if (window.game.loadGame()) {
        console.log('Saved game found.');
        // You could add logic here to ask if they want to continue or start new
        
        // Load game data then initialize
        window.game.loadGameData().then(() => {
            window.game.showGamePage();
            window.game.initGame();
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.game-nav li');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Get the tab to show
            const tabToShow = item.getAttribute('data-tab');
            
            // Here you would show/hide content based on the selected tab
            console.log(`Switching to ${tabToShow} tab`);
            
            // For now just a placeholder - you'll implement this later
            // when you have the actual content for Skills and Character tabs
            if (tabToShow === 'main') {
                // Code to show main content
            } else if (tabToShow === 'skills') {
                // Code to show skills content when implemented
            } else if (tabToShow === 'character') {
                // Code to show character content when implemented
            }
        });
    });
});