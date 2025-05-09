// Import the Character class if it's in a separate file
// You might need to adjust this import statement based on your project structure
import { Character } from './js/models/Character.js';

class Game {
    constructor() {
        this.player = null;
        this.initialized = false;
        
        // Get DOM elements
        this.welcomePage = document.getElementById('welcome-page');
        this.gamePage = document.getElementById('game-page');
        this.newGameForm = document.querySelector('.new-game-form');
        this.nameInput = document.querySelector('.name-input');
        
        // Initialize event listeners
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Add event listener for form submission
        this.newGameForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleStartGame();
        });
    }
    
    handleStartGame() {
        const playerName = this.nameInput.value.trim();
        
        // Validate player name
        if (!playerName) {
            alert('Please enter your name before entering the city.');
            return;
        }
        
        // Create a new character
        this.createNewCharacter(playerName);
        
        // Transition to game page
        this.showGamePage();
        
        // Initialize game systems
        this.initGame();
    }
    
    createNewCharacter(name) {
        // Create a new character instance
        this.player = new Character({
            name: name,
            // You can add more initialization data here
            stats: {
                strength: 5,
                intelligence: 5,
                charisma: 5,
                endurance: 5
            },
            currencies: {
                money: 10
            }
        });
        
        // Save character to local storage
        this.saveGame();
        
        console.log(`Created new character: ${name}`);
    }
    
    showGamePage() {
        // Hide welcome page and show game page
        this.welcomePage.style.display = 'none';
        this.gamePage.style.display = 'grid';
        
    }

    
    
    initGame() {
        if (this.initialized) return;
        
        // Initialize game panels
        this.initResourcePanel();
        this.initStatsPanel();
        this.initGamePanel();
        
        this.initialized = true;
        console.log('Game initialized');
    }
    
    initResourcePanel() {
        const resourcePanel = document.getElementById('resource-panel');
        resourcePanel.innerHTML = `
            <h3>Resources</h3>
            <p>Money: ${this.player.currencies.money || 0}</p>
        `;
    }
    
    initStatsPanel() {
        const statsPanel = document.getElementById('stats-panel');
        statsPanel.innerHTML = `
            <h3>Stats</h3>
            <p>Name: ${this.player.name}</p>
            <p>Level: ${this.player.level}</p>
            <p>Class: ${this.player.class}</p>
            <p>Strength: ${this.player.stats.strength}</p>
            <p>Intelligence: ${this.player.stats.intelligence}</p>
            <p>Charisma: ${this.player.stats.charisma}</p>
            <p>Endurance: ${this.player.stats.endurance}</p>
        `;
    }
    
    initGamePanel() {
        const gamePanel = document.getElementById('game-panel');
        gamePanel.innerHTML = `
            <h2>Welcome to the City, ${this.player.name}!</h2>
            <p>Your journey begins. Choose your path wisely.</p>
            <div class="action-buttons">
                <button id="explore-button">Explore the City</button>
                <button id="work-button">Find Work</button>
                <button id="rest-button">Rest at Home</button>
            </div>
        `;
        
        // Add event listeners to action buttons
        document.getElementById('explore-button').addEventListener('click', () => {
            this.addToActionLog(`${this.player.name} decided to explore the city.`);
        });
        
        document.getElementById('work-button').addEventListener('click', () => {
            this.addToActionLog(`${this.player.name} is looking for work.`);
        });
        
        document.getElementById('rest-button').addEventListener('click', () => {
            this.addToActionLog(`${this.player.name} is resting at home.`);
        });
    }
    
    addToActionLog(message) {
        const actionLog = document.getElementById('action-log');
        const logEntry = document.createElement('p');
        logEntry.textContent = message;
        actionLog.appendChild(logEntry);
        
        // Auto-scroll to the bottom
        actionLog.scrollTop = actionLog.scrollHeight;
    }
    
    saveGame() {
        // Save game state to localStorage
        localStorage.setItem('semitaeVitae_player', JSON.stringify(this.player));
    }
    
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
}

// Initialize game when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Semitae Vitae...');
    
    // Hide game page initially
    const gamePage = document.getElementById('game-page');
    gamePage.style.display = 'none';
    
    // Create and initialize game instance
    window.game = new Game();
    
    // Check for saved game
    if (window.game.loadGame()) {
        console.log('Saved game found.');
        // You could add logic here to ask if they want to continue or start new
    }
});
