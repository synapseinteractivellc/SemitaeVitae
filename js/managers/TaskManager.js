/**
 * TaskManager class
 * Responsible for executing and managing game tasks
 */
export class TaskManager {
    /**
     * Create a new TaskManager
     * @param {Object} game - Reference to the main game instance 
     */
    constructor(game) {
        this.game = game;
        this.player = game.player;
        this.taskDefinitions = game.taskDefinitions;
        
        // Track currently running task
        this.currentTask = null;
        this.lastTick = null;
        this.taskProgress = 0;
        this.effectInterval = null;
        this.runCostInterval = null;
    }

    /**
     * Start a task by its ID
     * @param {string} taskId - The task identifier
     * @returns {boolean} - True if the task started successfully
     */
    startTask(taskId) {
        // Find the task definition
        const taskDef = this.taskDefinitions.find(t => t.id === taskId);
        if (!taskDef) {
            console.error(`Task ${taskId} not found.`);
            return false;
        }

        // Get or create the task instance for this player
        let task = this.getOrCreatePlayerTask(taskId, taskDef);
        
        // Check task requirements and costs
        if (!this.canStartTask(task)) {
            console.log(`Cannot start task ${taskId}: requirements not met or resources full.`);
            return false;
        }

        // Check if it's an immediate task (non-perpetual with no length)
        if (!task.perpetual && !task.length) {
            return this.executeImmediateTask(task);
        }

        // If we already have a task running, stop it first
        if (this.currentTask) {
            this.stopCurrentTask();
        }

        // Apply initial costs (if any)
        if (task.cost) {
            this.applyResourceChanges(task.cost, true);
        }

        // Set as current task
        this.currentTask = task;
        this.taskProgress = 0;
        this.lastTick = Date.now();
        
        // Update player's current action reference
        this.player.currentAction = task;
        this.player.currentActionProgress = 0;
        this.player.currentActionDuration = task.length || 1000;
        
        // For perpetual tasks, set up recurring effect and cost applications
        if (task.perpetual) {
            this.setupPerpetualTaskIntervals(task);
        }
        
        // Update UI to show the task is running
        this.game.updateUI();
        
        // Log the action
        let taskName = task.verb || task.name || task.id;
        taskName = this.game.capitalizeFirstLetter(taskName);
        this.game.addToActionLog(`Started ${taskName}.`);
        
        // Set up the game tick update if not already running
        this.game.startGameTick();
        
        return true;
    }

    /**
     * Execute a task with instant completion (no length)
     * @param {Object} task - The task to execute
     * @returns {boolean} - True if the task completed successfully
     */
    executeImmediateTask(task) {
        // Apply costs
        if (task.cost && !this.applyResourceChanges(task.cost, true)) {
            return false;
        }

        // Apply results
        if (task.result) {
            this.applyResourceChanges(task.result, false);
        }

        // Track completion
        task.completions = (task.completions || 0) + 1;
        
        // Apply milestone upgrades if any
        this.applyMilestoneUpgrades(task);
        
        // Update the player's task record
        this.updatePlayerTask(task);

        // Log the action
        let taskName = task.name || task.id;
        taskName = this.game.capitalizeFirstLetter(taskName);
        this.game.addToActionLog(`Completed ${taskName}.`);
        
        // Update UI
        this.game.updateUI();
        
        return true;
    }

    /**
     * Get a player-specific task or create one if it doesn't exist
     * @param {string} taskId - The task identifier
     * @param {Object} taskDef - The task definition
     * @returns {Object} - The player's version of the task
     */
    getOrCreatePlayerTask(taskId, taskDef) {
        // Initialize player's tasks object if needed
        if (!this.player.tasks) {
            this.player.tasks = {};
        }
        
        // Check if player already has this task
        if (!this.player.tasks[taskId]) {
            // Create a clone of the task definition for this player
            this.player.tasks[taskId] = JSON.parse(JSON.stringify(taskDef));
            
            // Add tracking properties
            this.player.tasks[taskId].completions = 0;
            this.player.tasks[taskId].progress = 0;
        }
        
        return this.player.tasks[taskId];
    }

    /**
     * Update a player's task record
     * @param {Object} task - The task to update
     */
    updatePlayerTask(task) {
        if (!this.player.tasks) {
            this.player.tasks = {};
        }
        
        this.player.tasks[task.id] = task;
        
        // Save game state
        this.game.saveGame();
    }

    /**
     * Check if a task can be started
     * @param {Object} task - The task to check
     * @returns {boolean} - True if the task can be started
     */
    canStartTask(task) {
        // Check if all fill resources are full
        if (task.fill) {
            const fillResources = Array.isArray(task.fill) ? task.fill : [task.fill];
            
            // For arrays, check if ALL resources are full (not just one)
            const allFull = fillResources.every(resourceId => {
                // Check for tags in the resourceId (like "prismatic")
                if (resourceId.startsWith('t_')) {
                    const tag = resourceId.substring(2);
                    // Find all resources with this tag
                    const taggedResources = Object.values(this.player.resources)
                        .filter(r => r.tags && r.tags.includes(tag));
                    
                    // If ALL tagged resources are full, consider this fill condition met
                    return taggedResources.length > 0 && taggedResources.every(r => 
                        !r.locked && r.max > 0 && r.value >= r.max);
                }
                
                // Check a single resource
                return this.player.isResourceFull(resourceId);
            });
            
            if (allFull) {
                return false;
            }
        }
        
        // Check if there are sufficient resources for initial cost
        if (task.cost) {
            for (const [resourceId, amount] of Object.entries(task.cost)) {
                const resource = this.player.resources[resourceId];
                if (!resource || resource.locked || resource.value < amount) {
                    return false;
                }
            }
        }
        
        // Check for requirements (e.g., upgrades)
        if (task.require) {
            // Basic requirement check
            // In a real implementation, this would handle complex requirements
            // like "upgrades.woodax" or "resources.gold>=10"
            return this.checkRequirement(task.require);
        }
        
        return true;
    }

    /**
     * Check if a requirement is met
     * @param {string} requirementStr - The requirement string
     * @returns {boolean} - True if the requirement is met
     */
    checkRequirement(requirementStr) {
        // This is a simplified implementation
        // In a real game, you'd parse complex expressions
        
        // Handle upgrade requirements like "upgrades.woodax"
        if (requirementStr.startsWith('upgrades.')) {
            const upgradeId = requirementStr.split('.')[1];
            return this.player.upgrades && this.player.upgrades[upgradeId];
        }
        
        // Handle resource requirements like "resources.gold>=10"
        if (requirementStr.startsWith('resources.')) {
            const [resourcePart, valuePart] = requirementStr.split('>=');
            const resourceId = resourcePart.split('.')[1];
            const minValue = parseInt(valuePart);
            
            const resource = this.player.resources[resourceId];
            return resource && !resource.locked && resource.value >= minValue;
        }
        
        // Return true for now for any other requirements
        // A more complete implementation would parse complex conditions
        return true;
    }

    /**
     * Apply resource changes (costs or results)
     * @param {Object} changes - Resource changes to apply
     * @param {boolean} isSubtraction - True if subtracting resources (cost), false if adding (result)
     * @returns {boolean} - True if all changes were applied successfully
     */
    applyResourceChanges(changes, isSubtraction) {
        // Check if we have enough resources for costs
        if (isSubtraction) {
            for (const [resourceId, amount] of Object.entries(changes)) {
                const resource = this.player.resources[resourceId];
                if (!resource || resource.locked || resource.value < amount) {
                    return false;
                }
            }
        }
        
        // Apply the changes
        for (const [resourceId, amount] of Object.entries(changes)) {
            if (isSubtraction) {
                this.player.subtractResource(resourceId, amount);
            } else {
                this.player.addResource(resourceId, amount);
            }
        }
        
        // Update UI
        this.game.updateUI();
        
        return true;
    }

    /**
     * Set up intervals for perpetual tasks
     * @param {Object} task - The task
     */
    setupPerpetualTaskIntervals(task) {
        // Clear any existing intervals
        this.clearIntervals();
        
        // Set up effect interval (every 1000ms)
        if (task.effect) {
            this.effectInterval = setInterval(() => {
                this.applyTaskEffects(task);
            }, 1000);
        }
        
        // Set up run cost interval (every 1000ms)
        if (task.run) {
            this.runCostInterval = setInterval(() => {
                // If we can't pay the run cost, pause the task
                if (!this.applyResourceChanges(task.run, true)) {
                    this.pauseCurrentTask();
                }
            }, 1000);
        }
    }

    /**
     * Apply a task's effects
     * @param {Object} task - The task
     */
    applyTaskEffects(task) {
        if (!task.effect) return;
        
        // Apply effects to resources
        for (const [resourceId, effect] of Object.entries(task.effect)) {
            // Handle complex effect objects with value property
            if (typeof effect === 'object' && effect.value !== undefined) {
                this.player.addResource(resourceId, effect.value);
            } 
            // Handle simple numeric effects
            else if (typeof effect === 'number') {
                this.player.addResource(resourceId, effect);
            }
        }
        
        // Update UI
        this.game.updateUI();
    }

    /**
     * Apply milestone upgrades to a task
     * @param {Object} task - The task to upgrade
     */
    applyMilestoneUpgrades(task) {
        if (!task.at) return;
        
        const completions = task.completions || 0;
        
        // Check each milestone
        for (const [milestone, upgrades] of Object.entries(task.at)) {
            const milestoneCount = parseInt(milestone);
            
            // If we just reached this milestone
            if (completions === milestoneCount) {
                // Apply each upgrade
                for (const [upgradePath, value] of Object.entries(upgrades)) {
                    // Parse the upgrade path (e.g., "result.wood")
                    const path = upgradePath.split('.');
                    
                    // Traverse the path to the target property
                    let target = task;
                    for (let i = 0; i < path.length - 1; i++) {
                        if (!target[path[i]]) {
                            target[path[i]] = {};
                        }
                        target = target[path[i]];
                    }
                    
                    // Get the final property name
                    const prop = path[path.length - 1];
                    
                    // Update the value
                    if (typeof target[prop] === 'number') {
                        target[prop] += parseFloat(value);
                    } else {
                        target[prop] = value;
                    }
                }
                
                // Log the milestone
                const taskName = task.name || task.id;
                this.game.addToActionLog(`${this.game.capitalizeFirstLetter(taskName)} improved at ${completions} completions!`);
            }
        }
    }

    /**
     * Apply milestone upgrades based on "every" property
     * @param {Object} task - The task to upgrade
     */
    applyEveryMilestoneUpgrades(task) {
        if (!task.every) return;
        
        const completions = task.completions || 0;
        
        // Check each milestone pattern
        for (const [interval, upgrades] of Object.entries(task.every)) {
            const intervalCount = parseInt(interval);
            
            // If completions is a multiple of the interval
            if (completions % intervalCount === 0 && completions > 0) {
                // Apply each upgrade
                for (const [upgradePath, value] of Object.entries(upgrades)) {
                    // Parse the upgrade path (e.g., "effect.research")
                    const path = upgradePath.split('.');
                    
                    // Traverse the path to the target property
                    let target = task;
                    for (let i = 0; i < path.length - 1; i++) {
                        if (!target[path[i]]) {
                            target[path[i]] = {};
                        }
                        target = target[path[i]];
                    }
                    
                    // Get the final property name
                    const prop = path[path.length - 1];
                    
                    // Update the value
                    // Handle complex upgrade formats like "0.05:100"
                    if (typeof value === 'string' && value.includes(':')) {
                        const [amount, limit] = value.split(':').map(parseFloat);
                        if (!isNaN(amount)) {
                            // Only apply if we haven't reached the limit
                            if (!limit || target[prop] < limit) {
                                target[prop] += amount;
                                // Cap at limit if specified
                                if (limit && target[prop] > limit) {
                                    target[prop] = limit;
                                }
                            }
                        }
                    } 
                    // Simple numeric upgrade
                    else if (typeof target[prop] === 'number') {
                        target[prop] += parseFloat(value);
                    } 
                    // Direct value assignment
                    else {
                        target[prop] = value;
                    }
                }
                
                // Log the milestone
                const taskName = task.name || task.id;
                this.game.addToActionLog(`${this.game.capitalizeFirstLetter(taskName)} improved at ${completions} completions!`);
            }
        }
    }

    /**
     * Update task progress
     * @param {number} deltaTime - Time in milliseconds since last update
     * @returns {boolean} - True if task is still running
     */
    updateTaskProgress(deltaTime) {
        if (!this.currentTask) return false;
        
        const task = this.currentTask;
        const taskDuration = task.length || 1000;
        
        // Calculate progress increment
        const progressIncrement = deltaTime / taskDuration;
        
        // Update task progress
        this.taskProgress += progressIncrement;
        
        // Update player's current action progress for UI
        this.player.currentActionProgress = Math.min(this.taskProgress, 1);
        
        // Check if the task cycle is complete
        if (this.taskProgress >= 1) {
            // Apply result for non-perpetual tasks
            if (!task.perpetual && task.result) {
                this.applyResourceChanges(task.result, false);
            }
            
            // Increment completion counter
            task.completions = (task.completions || 0) + 1;
            
            // Apply milestone upgrades
            this.applyMilestoneUpgrades(task);
            this.applyEveryMilestoneUpgrades(task);
            
            // Update player's task record
            this.updatePlayerTask(task);
            
            // For perpetual tasks, reset progress and continue
            if (task.perpetual) {
                this.taskProgress = 0;
                
                // Log completion
                if (task.completions % 10 === 0) {
                    let taskName = task.verb || task.name || task.id;
                    taskName = this.game.capitalizeFirstLetter(taskName);
                    this.game.addToActionLog(`${taskName} (${task.completions} completions).`);
                }
                
                return true;
            } else {
                // For non-perpetual tasks, complete and stop
                this.completeCurrentTask();
                return false;
            }
        }
        
        return true;
    }

    /**
     * Complete the current task
     */
    completeCurrentTask() {
        if (!this.currentTask) return;
        
        // Log the completion
        let taskName = this.currentTask.verb || this.currentTask.name || this.currentTask.id;
        taskName = this.game.capitalizeFirstLetter(taskName);
        this.game.addToActionLog(`Completed ${taskName}.`);
        
        // Clear intervals
        this.clearIntervals();
        
        // Update player's references
        this.player.previousAction = this.currentTask;
        this.player.currentAction = null;
        this.player.currentActionProgress = 0;
        
        // Clear task
        this.currentTask = null;
        
        // Update UI
        this.game.updateUI();
    }

    /**
     * Stop the current task
     */
    stopCurrentTask() {
        if (!this.currentTask) return;
        
        // Save task progress for potential resuming
        this.currentTask.progress = this.taskProgress;
        this.updatePlayerTask(this.currentTask);
        
        // Log the interruption
        let taskName = this.currentTask.verb || this.currentTask.name || this.currentTask.id;
        taskName = this.game.capitalizeFirstLetter(taskName);
        this.game.addToActionLog(`Stopped ${taskName}.`);
        
        // Clear intervals
        this.clearIntervals();
        
        // Update player's references
        this.player.previousAction = this.currentTask;
        this.player.currentAction = null;
        this.player.currentActionProgress = 0;
        
        // Clear task
        this.currentTask = null;
        
        // Update UI
        this.game.updateUI();
    }

    /**
     * Pause the current task (e.g., due to insufficient resources)
     */
    pauseCurrentTask() {
        if (!this.currentTask) return;
        
        // Save task progress for resuming
        this.currentTask.progress = this.taskProgress;
        this.updatePlayerTask(this.currentTask);
        
        // Log the pause
        let taskName = this.currentTask.verb || this.currentTask.name || this.currentTask.id;
        taskName = this.game.capitalizeFirstLetter(taskName);
        this.game.addToActionLog(`Paused ${taskName} (insufficient resources).`);
        
        // Clear intervals
        this.clearIntervals();
        
        // Update player's reference but keep the current action
        this.player.currentAction = this.currentTask;
        
        // Update UI
        this.game.updateUI();
    }

    /**
     * Resume a paused task if possible
     * @param {string} taskId - The task identifier
     * @returns {boolean} - True if task resumed successfully
     */
    resumeTask(taskId) {
        if (!this.player.tasks || !this.player.tasks[taskId]) return false;
        
        const task = this.player.tasks[taskId];
        
        // Check if task can be resumed
        if (!this.canStartTask(task)) return false;
        
        // If we already have a task running, stop it first
        if (this.currentTask) {
            this.stopCurrentTask();
        }
        
        // Set as current task
        this.currentTask = task;
        this.taskProgress = task.progress || 0;
        this.lastTick = Date.now();
        
        // Update player's current action reference
        this.player.currentAction = task;
        this.player.currentActionProgress = this.taskProgress;
        this.player.currentActionDuration = task.length || 1000;
        
        // For perpetual tasks, set up recurring effect and cost applications
        if (task.perpetual) {
            this.setupPerpetualTaskIntervals(task);
        }
        
        // Log the resumption
        let taskName = task.verb || task.name || task.id;
        taskName = this.game.capitalizeFirstLetter(taskName);
        this.game.addToActionLog(`Resumed ${taskName}.`);
        
        // Update UI
        this.game.updateUI();
        
        return true;
    }

    /**
     * Clear all intervals
     */
    clearIntervals() {
        if (this.effectInterval) {
            clearInterval(this.effectInterval);
            this.effectInterval = null;
        }
        
        if (this.runCostInterval) {
            clearInterval(this.runCostInterval);
            this.runCostInterval = null;
        }
    }

    /**
     * Process a game tick
     * @param {number} deltaTime - Time in milliseconds since last tick
     */
    processTick(deltaTime) {
        if (!this.currentTask) return;
        
        // Update task progress
        this.updateTaskProgress(deltaTime);
        
        // Update UI
        this.game.updateUI();
    }
}