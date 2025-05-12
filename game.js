// Import the Character class from the updated file
import { Character } from './js/models/Character.js';

class Game {
    constructor() {
        this.player = null;
        this.initialized = false;
        this.resourceDefinitions = [];
        this.taskDefinitions = [];
       
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
        this.newGameForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleStartGame();
        });

        // Add event listeners for save and wipe buttons
        document.getElementById('save-button')?.addEventListener('click', () => {
            this.saveGame();
            this.addToActionLog('Game saved.');
        });

        document.getElementById('wipe-button')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to wipe all saved data? This cannot be undone.')) {
                localStorage.removeItem('semitaeVitae_player');
                this.addToActionLog('Game data wiped.');
                location.reload(); // Reload the page to start fresh
            }
        });
    }
    
    /**
     * Handle the start game button click
     */
    handleStartGame() {
        const playerName = this.nameInput.value.trim();
        
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
        this.welcomePage.style.display = 'none';
        this.gamePage.style.display = 'grid';
    }
    
    /**
     * Initialize the game systems
     */
    initGame() {
        if (this.initialized) return;

        this.initResourcePanel();
        this.initStatsPanel();
        this.initGamePanel();
        
        this.initialized = true;
        console.log('Game initialized');
    }
    
    /**
     * Initialize the resource panel
     */
    initResourcePanel() {
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
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    icon.textContent = '►';
                }
            });
        });
    }
    
    /**
     * Initialize the stats panel
     */
    initStatsPanel() {
        let html = '';
        
        // Add current action display
        html += `
            <div class="current-action">
                <span class="action-name">Idle</span>
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
     * Initialize the game panel with task buttons
     */
    initGamePanel() {
        let html = `            
            <div class="action-buttons">
        `;
        
        // Get all available tasks
        const availableTasks = this.getAvailableTasks();

        if (availableTasks.length === 0) {
            html += `<p>No tasks available. Grow your skills.</p>`;
            html += `</div>`;
            this.gamePanel.innerHTML = html;
            return;
        }
        
        // Group tasks by their group property
        const taskGroups = this.groupTasksByProperty(availableTasks, 'group');
        
        // Generate HTML for each task group
        Object.entries(taskGroups).forEach(([group, tasks]) => {
            html += `
                <div class="task-group">
                    <div class="task-group-header" data-group="${group}">
                        <span class="collapse-icon">▼</span> ${this.capitalizeFirstLetter(group)}
                    </div>
                    <div class="task-group-content" id="task-group-${group}">
            `;
            
            // Add buttons for each task
            tasks.forEach(task => {
                const isDisabled = !this.canExecuteTask(task);
                const buttonClass = isDisabled ? 'task-button disabled' : 'task-button';
                let taskDisplayName = this.capitalizeFirstLetter(task.name) || this.capitalizeFirstLetter(task.id);
                
                html += `
                    <button class="${buttonClass}" 
                            data-task-id="${task.id}" 
                            title="${task.desc || ''}"
                            ${isDisabled ? 'disabled' : ''}>
                        ${taskDisplayName}
                    </button>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        
        this.gamePanel.innerHTML = html;
        
        // Add event listeners for task buttons
        document.querySelectorAll('.task-button').forEach(button => {
            button.addEventListener('click', () => {
                const taskId = button.getAttribute('data-task-id');
                this.startTask(taskId);
            });
        });
        
        // Add event listeners for collapsible task groups
        document.querySelectorAll('.task-group-header').forEach(header => {
            header.addEventListener('click', () => {
                const group = header.getAttribute('data-group');
                const content = document.getElementById(`task-group-${group}`);
                const icon = header.querySelector('.collapse-icon');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    icon.textContent = '►';
                }
            });
        });
    }
    
    /**
     * Get all available tasks for the player
     * @returns {Array} - Array of available tasks
     */
    getAvailableTasks() {
        // Filter tasks that are not locked
        // A task is available if it's not explicitly locked (locked === false or locked is undefined)
        return this.taskDefinitions.filter(task => task.locked === false);
    }
    
    /**
     * Group an array of objects by a property
     * @param {Array} array - Array to group
     * @param {string} property - Property to group by
     * @returns {Object} - Grouped object
     */
    groupTasksByProperty(array, property) {
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
     * Check if a task can be executed
     * @param {Object} task - Task definition
     * @returns {boolean} - True if task can be executed
     */
    canExecuteTask(task) {
        // Check if the player has enough resources to execute this task
        if (task.cost) {
            for (const [resourceId, amount] of Object.entries(task.cost)) {
                const resource = this.player.resources[resourceId];
                if (!resource || resource.locked || resource.value < amount) {
                    return false;
                }
            }
        }
        
        // Check if the result resource is already full
        if (task.fill && this.player.isResourceFull(task.fill)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Update all UI elements
     */
    updateUI() {
        this.updateResourcePanel();
        this.updateStatsPanel();
        this.updateGamePanel();
    }
    
    /**
     * Update just the resource values in the resource panel
     */
    updateResourcePanel() {
        // Update each resource value display
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
        // Update current action progress
        const actionNameElement = document.querySelector('.action-name');
        const progressElement = document.querySelector('.progress');
        
        if (this.player.currentAction) {
            const task = this.player.currentAction;
            const progress = this.player.currentActionProgress * 100;
            
            actionNameElement.textContent = task.verb || task.name || task.id;
            progressElement.style.width = `${progress}%`;
        } else {
            actionNameElement.textContent = 'Idle';
            progressElement.style.width = '0%';
        }
        
        // Update stat resources
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
    
    /**
     * Update the game panel (task availability)
     */
    updateGamePanel() {
        // Update task button disabled states
        document.querySelectorAll('.task-button').forEach(button => {
            const taskId = button.getAttribute('data-task-id');
            const task = this.taskDefinitions.find(t => t.id === taskId);
            
            if (task) {
                const canExecute = this.canExecuteTask(task);
                button.disabled = !canExecute;
                button.classList.toggle('disabled', !canExecute);
            }
        });
    }
    
    /**
     * Start the game tick interval
     */
    startGameTick() {
        if (!this.gameTickInterval) {
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
     * Add a message to the action log
     * @param {string} message - Message to add
     */
    addToActionLog(message) {
        const actionLog = this.actionLog;
        
        // Create container for log entries if it doesn't exist
        let logEntries = actionLog.querySelector('.log-entries');
        if (!logEntries) {
            actionLog.innerHTML = '<h3>Action Log</h3><div class="log-entries"></div>';
            logEntries = actionLog.querySelector('.log-entries');
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
            const playerData = JSON.parse(savedPlayer);
            this.player = new Character(playerData);
            return true;
        }
        return false;
    }
    
    /**
     * Helper function to capitalize the first letter of a string
     * @param {string} string - String to capitalize
     * @returns {string} - Capitalized string
     */
    capitalizeFirstLetter(string) {
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