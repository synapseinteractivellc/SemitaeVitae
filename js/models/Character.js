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
        this.xpToNextLevel = data.xpToNextLevel || 100;
        
        // Timestamps
        this.created = data.created || Date.now();
        this.lastPlayed = data.lastPlayed || Date.now();
        this.offlineTime = data.offlineTime || 0;
        
        // Enhanced resource handling
        this.resources = data.resources || {};
        
        // Other systems from original code
        this.stats = data.stats || {};
        this.skills = data.skills || {};
        this.tasks = data.tasks || {};
        this.upgrades = data.upgrades || {};
        this.quests = data.quests || {};
        this.actionQueue = data.actionQueue || [];
        this.home = data.home || {};
        this.characterAchievements = data.characterAchievements || {};
        
        // Current action tracking
        this.currentAction = data.currentAction || null;
        this.currentActionProgress = data.currentActionProgress || 0;
        this.currentActionDuration = data.currentActionDuration || 0;
        this.previousAction = data.previousAction || null;
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
     * Check if all resources in a list are full
     * @param {Array|string} resourceIds - List of resource IDs or a single ID
     * @returns {boolean} - True if all specified resources are full
     */
    areResourcesFull(resourceIds) {
        if (!resourceIds) return false;
        
        // Convert single resource to array
        const ids = Array.isArray(resourceIds) ? resourceIds : [resourceIds];
        
        // Check each resource in the array
        for (const id of ids) {
            // Special handling for tagged resources
            if (id.startsWith('t_')) {
                const tag = id.substring(2);
                // Find all resources with this tag
                const taggedResources = Object.values(this.resources)
                    .filter(r => r.tags && r.tags.includes(tag));
                
                // If any tagged resource is not full, return false
                if (taggedResources.length === 0 || taggedResources.some(r => 
                    r.locked || !r.max || r.max <= 0 || r.value < r.max)) {
                    return false;
                }
            } 
            // Regular resource check
            else if (!this.isResourceFull(id)) {
                return false;
            }
        }
        
        // All resources are full
        return true;
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
     * Get all resources that have a specific tag
     * @param {string} tag - The tag to search for
     * @returns {Array} - Array of resources with that tag
     */
    getResourcesByTag(tag) {
        return Object.values(this.resources)
            .filter(resource => resource.tags && resource.tags.includes(tag))
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
    
    /**
     * Check if player has an upgrade
     * @param {string} upgradeId - The upgrade identifier
     * @returns {boolean} - True if the player has the upgrade
     */
    hasUpgrade(upgradeId) {
        return this.upgrades && this.upgrades[upgradeId] && this.upgrades[upgradeId] > 0;
    }
    
    /**
     * Check if a requirement string is met
     * @param {string} requirementStr - Requirement string to evaluate
     * @returns {boolean} - True if the requirement is met
     */
    meetsRequirement(requirementStr) {
        // This is a simplified implementation
        // In a real game, you'd parse complex expressions
        
        // Handle upgrade requirements like "upgrades.woodax"
        if (requirementStr.startsWith('upgrades.')) {
            const upgradeId = requirementStr.split('.')[1];
            return this.hasUpgrade(upgradeId);
        }
        
        // Handle resource requirements like "resources.gold>=10"
        if (requirementStr.startsWith('resources.')) {
            const [resourcePart, valuePart] = requirementStr.split('>=');
            const resourceId = resourcePart.split('.')[1];
            const minValue = parseInt(valuePart);
            
            const resource = this.resources[resourceId];
            return resource && !resource.locked && resource.value >= minValue;
        }
        
        // Handle skill requirements
        if (requirementStr.startsWith('skills.')) {
            const [skillPart, valuePart] = requirementStr.split('>=');
            const skillId = skillPart.split('.')[1];
            const minValue = parseInt(valuePart);
            
            const skill = this.skills[skillId];
            return skill && skill.level >= minValue;
        }
        
        // Return true for now for any other requirements
        // A more complete implementation would parse complex conditions
        return true;
    }
}

export { Character };