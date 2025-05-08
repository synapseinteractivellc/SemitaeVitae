class Character {
    /**
     * Create a new character
     * @param {Object} data - Character initialization data
     */
    constructor(data = {}) {
        // Unique identifier
        this.id = data.id || `char_${Date.now()}`;
        
        // Basic character info
        this.name = data.name || 'Unnamed';
        this.class = data.class ? data.class.toLowerCase() : 'waif';
        this.level = data.level || 0;
        this.experience = data.experience || 0;
        this.xpToNextLevel = data.expToNextLevel || 100;
        
        // Timestamps
        this.created = data.created || Date.now();
        this.lastPlayed = data.lastPlayed || Date.now();
        this.offlineTime = data.offlineTime || 0;
        
        // Core game systems
        this.stats = data.stats || {};
        this.skills = data.skills || {};
        this.currencies = data.currencies || {};
        
        // Action and progression systems
        this.actions = data.actions || {};
        this.quests = data.quests || {};
        this.actionQueue = data.actionQueue || [];
        
        // Home and progression
        this.home = data.home || {};
        
        // Achievement tracking
        this.characterAchievements = data.characterAchievements || {};
    }
}

export { Character };