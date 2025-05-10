// Updated Character class for resource handling
class Character {
    /**
     * Create a new character
     * @param {Object} data - Character initialization data
     */
    constructor(data = {}) {
        // Basic character info (from original code)
        this.id = data.id || `char_${Date.now()}`;
        this.name = data.name || 'Unnamed';
        this.class = data.class ? data.class.toLowerCase() : 'waif';
        this.level = data.level || 0;
        this.experience = data.experience || 0;
        this.xpToNextLevel = data.expToNextLevel || 100;
        
        // Timestamps
        this.created = data.created || Date.now();
        this.lastPlayed = data.lastPlayed || Date.now();
        this.offlineTime = data.offlineTime || 0;
        
        // Enhanced resource handling
        this.resources = data.resources || {};
        
        // Other systems from original code
        this.stats = data.stats || {};
        this.skills = data.skills || {};
        this.actions = data.actions || {};
        this.quests = data.quests || {};
        this.actionQueue = data.actionQueue || [];
        this.home = data.home || {};
        this.characterAchievements = data.characterAchievements || {};
        
        // Current action tracking
        this.currentAction = data.currentAction || null;
        this.currentActionProgress = data.currentActionProgress || 0;
        this.currentActionDuration = data.currentActionDuration || 0;
    }
    
    /**
     * Initialize a resource for this character
     * @param {Object} resourceData - Resource definition from resources.json
     */
    initResource(resourceData) {
        // Skip if this resource is already initialized
        if (this.resources[resourceData.id]) return;
        
        this.resources[resourceData.id] = {
            id: resourceData.id,
            name: resourceData.name || resourceData.id,
            value: 0,
            max: resourceData.max || 0,
            rate: 0, // Resource generation/consumption rate per second
            locked: resourceData.locked !== false, // Default to locked unless explicitly marked as unlocked
            desc: resourceData.desc || '',
            group: resourceData.group || 'misc',
            tags: resourceData.tags ? resourceData.tags.split(',').map(tag => tag.trim()) : [],
            sortOrder: resourceData.sortOrder || 999
        };
    }
    
    /**
     * Add a specified amount to a resource, respecting maximum values
     * @param {string} resourceId - The resource identifier
     * @param {number} amount - Amount to add
     * @returns {boolean} - True if resource was changed
     */
    addResource(resourceId, amount) {
        const resource = this.resources[resourceId];
        if (!resource || resource.locked) return false;
        
        // Calculate new value respecting maximum
        const newValue = resource.value + amount;
        resource.value = (resource.max > 0) ? Math.min(newValue, resource.max) : newValue;
        
        return true;
    }
    
    /**
     * Subtract a specified amount from a resource
     * @param {string} resourceId - The resource identifier
     * @param {number} amount - Amount to subtract
     * @returns {boolean} - True if resource was changed and had sufficient amount
     */
    subtractResource(resourceId, amount) {
        const resource = this.resources[resourceId];
        if (!resource || resource.locked || resource.value < amount) return false;
        
        resource.value -= amount;
        return true;
    }
    
    /**
     * Check if a resource is at its maximum value
     * @param {string} resourceId - The resource identifier
     * @returns {boolean} - True if resource is at max
     */
    isResourceFull(resourceId) {
        const resource = this.resources[resourceId];
        if (!resource || resource.locked) return false;
        
        // If max is 0 or undefined, the resource can't be full
        if (!resource.max || resource.max <= 0) return false;
        
        // Check if current value is at or above max
        return resource.value >= resource.max;
    }
        
    /**
     * Unlock a resource that was previously locked
     * @param {string} resourceId - The resource identifier
     */
    unlockResource(resourceId) {
        const resource = this.resources[resourceId];
        if (resource) {
            resource.locked = false;
        }
    }
    
    /**
     * Get all resources that belong to a specific group
     * @param {string} group - The group name
     * @returns {Array} - Array of resources in that group
     */
    getResourcesByGroup(group) {
        return Object.values(this.resources)
            .filter(resource => resource.group === group)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    
    /**
     * Get all unlocked resources
     * @returns {Array} - Array of unlocked resources
     */
    getUnlockedResources() {
        return Object.values(this.resources)
            .filter(resource => !resource.locked)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    
    /**
     * Get all stat-type resources (sortOrder >= 705)
     * @returns {Array} - Array of stat resources
     */
    getStatResources() {
        return Object.values(this.resources)
            .filter(resource => resource.sortOrder >= 705)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    
    /**
     * Get all unlocked stat-type resources
     * @returns {Array} - Array of unlocked stat resources
     */
    getUnlockedStatResources() {
        return this.getStatResources().filter(resource => !resource.locked);
    }
}

export { Character };