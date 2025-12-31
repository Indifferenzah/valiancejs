class CooldownHandler {
    constructor(config) {
        this.config = config;
        this.userCooldowns = new Map();
        this.globalCooldown = null;
    }

    isOnCooldown(userId) {
        if (!this.config.enabled) {
            return false;
        }

        if (this.config.perUser) {
            const userCooldown = this.userCooldowns.get(userId);
            if (userCooldown && Date.now() < userCooldown) {
                return true;
            }
        }

        if (this.globalCooldown && Date.now() < this.globalCooldown) {
            return true;
        }

        return false;
    }

    setCooldown(userId) {
        if (!this.config.enabled) {
            return;
        }

        const cooldownEnd = Date.now() + this.config.duration;

        if (this.config.perUser) {
            this.userCooldowns.set(userId, cooldownEnd);

            setTimeout(() => {
                this.userCooldowns.delete(userId);
            }, this.config.duration);
        }

        this.globalCooldown = Date.now() + 1000;
    }

    getRemainingCooldown(userId) {
        if (!this.config.enabled) {
            return 0;
        }

        if (this.config.perUser) {
            const userCooldown = this.userCooldowns.get(userId);
            if (userCooldown) {
                const remaining = userCooldown - Date.now();
                return Math.max(0, remaining);
            }
        }

        if (this.globalCooldown) {
            const remaining = this.globalCooldown - Date.now();
            return Math.max(0, remaining);
        }

        return 0;
    }

    clearCooldown(userId) {
        this.userCooldowns.delete(userId);
    }

    clearAllCooldowns() {
        this.userCooldowns.clear();
        this.globalCooldown = null;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

module.exports = CooldownHandler;
