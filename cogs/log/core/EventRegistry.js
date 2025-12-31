const EventRegistry = {
    CHANNELS: {
        CHANNEL_CREATE: {
            name: 'channelCreate',
            description: 'Un canale viene creato',
            category: 'channels',
            icon: '📢',
            color: '#43B581'
        },
        CHANNEL_DELETE: {
            name: 'channelDelete',
            description: 'Un canale viene eliminato',
            category: 'channels',
            icon: '🗑️',
            color: '#F04747'
        },
        CHANNEL_UPDATE: {
            name: 'channelUpdate',
            description: 'Un canale viene aggiornato',
            category: 'channels',
            icon: '✏️',
            color: '#FAA61A'
        },
        CHANNEL_PINS_UPDATE: {
            name: 'channelPinsUpdate',
            description: 'I messaggi pinnati di un canale cambiano',
            category: 'channels',
            icon: '📌',
            color: '#5865F2'
        }
  },
  
    THREADS: {
        THREAD_CREATE: {
            name: 'threadCreate',
            description: 'Un thread viene creato',
            category: 'threads',
            icon: '🧵',
            color: '#43B581'
        },
        THREAD_DELETE: {
            name: 'threadDelete',
            description: 'Un thread viene eliminato',
            category: 'threads',
            icon: '🗑️',
            color: '#F04747'
        },
        THREAD_UPDATE: {
            name: 'threadUpdate',
            description: 'Un thread viene aggiornato',
            category: 'threads',
            icon: '✏️',
            color: '#FAA61A'
        },
        THREAD_LIST_SYNC: {
            name: 'threadListSync',
            description: 'Sincronizzazione lista thread',
            category: 'threads',
            icon: '🔄',
            color: '#5865F2'
        },
        THREAD_MEMBER_UPDATE: {
            name: 'threadMemberUpdate',
            description: 'Un membro di un thread viene aggiornato',
            category: 'threads',
            icon: '👤',
            color: '#FAA61A'
        },
        THREAD_MEMBERS_UPDATE: {
            name: 'threadMembersUpdate',
            description: 'I membri di un thread vengono aggiornati',
            category: 'threads',
            icon: '👥',
            color: '#FAA61A'
        }
    },

    MEMBERS: {
        GUILD_MEMBER_ADD: {
            name: 'guildMemberAdd',
            description: 'Un membro entra nel server',
            category: 'members',
            icon: '👋',
            color: '#43B581'
        },
        GUILD_MEMBER_REMOVE: {
            name: 'guildMemberRemove',
            description: 'Un membro lascia il server',
            category: 'members',
            icon: '👋',
            color: '#F04747'
        },
        GUILD_MEMBER_UPDATE: {
            name: 'guildMemberUpdate',
            description: 'Un membro del server viene aggiornato',
            category: 'members',
            icon: '👤',
            color: '#FAA61A'
        },
        GUILD_MEMBER_AVAILABLE: {
            name: 'guildMemberAvailable',
            description: 'Un membro diventa disponibile in una large guild',
            category: 'members',
            icon: '✅',
            color: '#43B581'
        },
        GUILD_MEMBERS_CHUNK: {
            name: 'guildMembersChunk',
            description: 'Ricevuto un chunk di membri',
            category: 'members',
            icon: '📦',
            color: '#5865F2'
        }
    },

    MESSAGES: {
        MESSAGE_CREATE: {
            name: 'messageCreate',
            description: 'Un messaggio viene inviato',
            category: 'messages',
            icon: '💬',
            color: '#5865F2'
        },
        MESSAGE_DELETE: {
            name: 'messageDelete',
            description: 'Un messaggio viene eliminato',
            category: 'messages',
            icon: '🗑️',
            color: '#F04747'
        },
        MESSAGE_UPDATE: {
            name: 'messageUpdate',
            description: 'Un messaggio viene modificato',
            category: 'messages',
            icon: '✏️',
            color: '#FAA61A'
        },
        MESSAGE_BULK_DELETE: {
            name: 'messageDeleteBulk',
            description: 'Più messaggi vengono eliminati in bulk',
            category: 'messages',
            icon: '🗑️',
            color: '#F04747'
        },
        MESSAGE_REACTION_ADD: {
            name: 'messageReactionAdd',
            description: 'Una reazione viene aggiunta a un messaggio',
            category: 'messages',
            icon: '➕',
            color: '#43B581'
        },
        MESSAGE_REACTION_REMOVE: {
            name: 'messageReactionRemove',
            description: 'Una reazione viene rimossa da un messaggio',
            category: 'messages',
            icon: '➖',
            color: '#F04747'
        },
        MESSAGE_REACTION_REMOVE_ALL: {
            name: 'messageReactionRemoveAll',
            description: 'Tutte le reazioni vengono rimosse da un messaggio',
            category: 'messages',
            icon: '🧹',
            color: '#F04747'
        },
        MESSAGE_REACTION_REMOVE_EMOJI: {
            name: 'messageReactionRemoveEmoji',
            description: 'Tutte le reazioni di un emoji vengono rimosse',
            category: 'messages',
            icon: '🧹',
            color: '#F04747'
        }
    },

    MODERATION: {
        GUILD_BAN_ADD: {
            name: 'guildBanAdd',
            description: 'Un utente viene bannato',
            category: 'moderation',
            icon: '🔨',
            color: '#F04747'
        },
        GUILD_BAN_REMOVE: {
            name: 'guildBanRemove',
            description: 'Un utente viene sbannato',
            category: 'moderation',
            icon: '✅',
            color: '#43B581'
        },
        GUILD_AUDIT_LOG_ENTRY_CREATE: {
            name: 'guildAuditLogEntryCreate',
            description: 'Viene creata una voce nell\'audit log',
            category: 'moderation',
            icon: '📋',
            color: '#5865F2'
        }
    },

    GUILD: {
        GUILD_UPDATE: {
            name: 'guildUpdate',
            description: 'Il server viene aggiornato',
            category: 'guild',
            icon: '🏠',
            color: '#FAA61A'
        },
        GUILD_UNAVAILABLE: {
            name: 'guildUnavailable',
            description: 'Il server diventa non disponibile',
            category: 'guild',
            icon: '⚠️',
            color: '#F04747'
        },
        GUILD_INTEGRATIONS_UPDATE: {
            name: 'guildIntegrationsUpdate',
            description: 'Le integrazioni del server vengono aggiornate',
            category: 'guild',
            icon: '🔌',
            color: '#FAA61A'
        },
        GUILD_SCHEDULED_EVENT_CREATE: {
            name: 'guildScheduledEventCreate',
            description: 'Viene creato un evento programmato',
            category: 'guild',
            icon: '📅',
            color: '#43B581'
        },
        GUILD_SCHEDULED_EVENT_UPDATE: {
            name: 'guildScheduledEventUpdate',
            description: 'Un evento programmato viene aggiornato',
            category: 'guild',
            icon: '📅',
            color: '#FAA61A'
        },
        GUILD_SCHEDULED_EVENT_DELETE: {
            name: 'guildScheduledEventDelete',
            description: 'Un evento programmato viene eliminato',
            category: 'guild',
            icon: '📅',
            color: '#F04747'
        },
        GUILD_SCHEDULED_EVENT_USER_ADD: {
            name: 'guildScheduledEventUserAdd',
            description: 'Un utente si iscrive a un evento',
            category: 'guild',
            icon: '✅',
            color: '#43B581'
        },
        GUILD_SCHEDULED_EVENT_USER_REMOVE: {
            name: 'guildScheduledEventUserRemove',
            description: 'Un utente si disiscrive da un evento',
            category: 'guild',
            icon: '❌',
            color: '#F04747'
        }
    },

    INVITES: {
        INVITE_CREATE: {
            name: 'inviteCreate',
            description: 'Un invito viene creato',
            category: 'invites',
            icon: '🎫',
            color: '#43B581'
        },
        INVITE_DELETE: {
            name: 'inviteDelete',
            description: 'Un invito viene eliminato',
            category: 'invites',
            icon: '🎫',
            color: '#F04747'
        }
    },

    ROLES: {
        ROLE_CREATE: {
            name: 'roleCreate',
            description: 'Un ruolo viene creato',
            category: 'roles',
            icon: '🎭',
            color: '#43B581'
        },
        ROLE_DELETE: {
            name: 'roleDelete',
            description: 'Un ruolo viene eliminato',
            category: 'roles',
            icon: '🎭',
            color: '#F04747'
        },
        ROLE_UPDATE: {
            name: 'roleUpdate',
            description: 'Un ruolo viene aggiornato',
            category: 'roles',
            icon: '🎭',
            color: '#FAA61A'
        }
    },

    EMOJIS: {
        EMOJI_CREATE: {
            name: 'emojiCreate',
            description: 'Un emoji viene creato',
            category: 'emojis',
            icon: '😀',
            color: '#43B581'
        },
        EMOJI_DELETE: {
            name: 'emojiDelete',
            description: 'Un emoji viene eliminato',
            category: 'emojis',
            icon: '😢',
            color: '#F04747'
        },
        EMOJI_UPDATE: {
            name: 'emojiUpdate',
            description: 'Un emoji viene aggiornato',
            category: 'emojis',
            icon: '😊',
            color: '#FAA61A'
        }
    },

    STICKERS: {
        STICKER_CREATE: {
            name: 'stickerCreate',
            description: 'Uno sticker viene creato',
            category: 'stickers',
            icon: '🎨',
            color: '#43B581'
        },
        STICKER_DELETE: {
            name: 'stickerDelete',
            description: 'Uno sticker viene eliminato',
            category: 'stickers',
            icon: '🎨',
            color: '#F04747'
        },
        STICKER_UPDATE: {
            name: 'stickerUpdate',
            description: 'Uno sticker viene aggiornato',
            category: 'stickers',
            icon: '🎨',
            color: '#FAA61A'
        }
    },

    VOICE: {
        VOICE_STATE_UPDATE: {
            name: 'voiceStateUpdate',
            description: 'Lo stato voice di un utente cambia',
            category: 'voice',
            icon: '🔊',
            color: '#FAA61A'
        }
    },

    PRESENCE: {
        PRESENCE_UPDATE: {
            name: 'presenceUpdate',
            description: 'La presenza di un utente viene aggiornata',
            category: 'presence',
            icon: '🟢',
            color: '#FAA61A'
        }
    },

    WEBHOOKS: {
        WEBHOOKS_UPDATE: {
            name: 'webhooksUpdate',
            description: 'I webhook di un canale vengono aggiornati',
            category: 'webhooks',
            icon: '🪝',
            color: '#FAA61A'
        }
    },

    INTERACTIONS: {
        INTERACTION_CREATE: {
            name: 'interactionCreate',
            description: 'Viene creata un\'interazione',
            category: 'interactions',
            icon: '⚡',
            color: '#5865F2'
        }
    },

    STAGE: {
        STAGE_INSTANCE_CREATE: {
            name: 'stageInstanceCreate',
            description: 'Viene creato uno stage',
            category: 'stage',
            icon: '🎤',
            color: '#43B581'
        },
        STAGE_INSTANCE_UPDATE: {
            name: 'stageInstanceUpdate',
            description: 'Uno stage viene aggiornato',
            category: 'stage',
            icon: '🎤',
            color: '#FAA61A'
        },
        STAGE_INSTANCE_DELETE: {
            name: 'stageInstanceDelete',
            description: 'Uno stage viene eliminato',
            category: 'stage',
            icon: '🎤',
            color: '#F04747'
        }
    },

    AUTOMOD: {
        AUTOMOD_RULE_CREATE: {
            name: 'autoModerationRuleCreate',
            description: 'Viene creata una regola di automod',
            category: 'automod',
            icon: '🛡️',
            color: '#43B581'
        },
        AUTOMOD_RULE_UPDATE: {
            name: 'autoModerationRuleUpdate',
            description: 'Una regola di automod viene aggiornata',
            category: 'automod',
            icon: '🛡️',
            color: '#FAA61A'
        },
        AUTOMOD_RULE_DELETE: {
            name: 'autoModerationRuleDelete',
            description: 'Una regola di automod viene eliminata',
            category: 'automod',
            icon: '🛡️',
            color: '#F04747'
        },
        AUTOMOD_ACTION_EXECUTION: {
            name: 'autoModerationActionExecution',
            description: 'Viene eseguita un\'azione di automod',
            category: 'automod',
            icon: '⚔️',
            color: '#F04747'
        }
    },

    USERS: {
        USER_UPDATE: {
            name: 'userUpdate',
            description: 'Un utente viene aggiornato',
            category: 'users',
            icon: '👤',
            color: '#FAA61A'
        }
    },

    getAllEvents() {
        const events = [];
        for (const category in this) {
            if (typeof this[category] === 'object' && category !== 'getAllEvents' && category !== 'getEventByName' && category !== 'getEventsByCategory' && category !== 'getCategoryNames') {
                for (const eventKey in this[category]) {
                    events.push({
                        key: eventKey,
                        ...this[category][eventKey]
                    });
                }
            }
        }
        return events;
    },

    getEventByName(name) {
        for (const category in this) {
            if (typeof this[category] === 'object' && category !== 'getAllEvents' && category !== 'getEventByName' && category !== 'getEventsByCategory' && category !== 'getCategoryNames') {
                for (const eventKey in this[category]) {
                    if (this[category][eventKey].name === name) {
                        return {
                            key: eventKey,
                            ...this[category][eventKey]
                        };
                    }
                }
            }
        }
        return null;
    },

    getEventsByCategory(categoryName) {
        for (const category in this) {
            if (typeof this[category] === 'object' && category !== 'getAllEvents' && category !== 'getEventByName' && category !== 'getEventsByCategory' && category !== 'getCategoryNames') {
                const firstEvent = Object.values(this[category])[0];
                if (firstEvent && firstEvent.category === categoryName) {
                    const events = [];
                    for (const eventKey in this[category]) {
                        events.push({
                            key: eventKey,
                            ...this[category][eventKey]
                        });
                    }
                    return events;
                }
            }
        }
        return [];
    },

    getCategoryNames() {
        const categories = new Set();
        for (const category in this) {
            if (typeof this[category] === 'object' && category !== 'getAllEvents' && category !== 'getEventByName' && category !== 'getEventsByCategory' && category !== 'getCategoryNames') {
                const firstEvent = Object.values(this[category])[0];
                if (firstEvent && firstEvent.category) {
                    categories.add(firstEvent.category);
                }
            }
        }
        return Array.from(categories);
    }
};

module.exports = EventRegistry;
