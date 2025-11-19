const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const logger = require('../../utils/logger');

const categories = {
    'moderation': {
        'emoji': '🛡️',
        'name': 'Moderazione',
        'commands': [
            '\\- `/ban` <utente> [reason] - Banna un membro',
            '\\- `/kick` <utente> - Kicka un membro',
            '\\- `/mute` <utente> - Muta un membro',
            '\\- `/unmute` <utente> - Smuta un membro',
            '\\- `/warn` <utente> - Aggiungi un warn',
            '\\- `/warn add` <utente> - Rimuovi un warn',
            '\\- `/warn list` <utente> - Mostra i warn di un utente',
            '\\- `/warn clear` <utente> - Rimuovi tutti i warn',
            '\\- `/listban` - Mostra i ban',
            '\\- `/checkban` <id utente> - Controlla se un utente è bannato',
            '\\- `/checkmute` <utente> - Controlla se un utente è mutato',
            '\\- `/nick` <nick> <utente> - Imposta nickname a un utente'
        ]
    },
    'ticket': {
        'emoji': '🎫',
        'name': 'Ticket',
        'commands': [
            '\\- `/ticketpanel` - Crea pannello ticket',
            '\\- `/close` - Chiudi ticket',
            '\\- `/transcript` <id ticket> - Visualizza transcript di un ticket',
            '\\- `/add` <utente> - Aggiungi utente al ticket',
            '\\- `/remove` <utente> - Rimuovi utente dal ticket',
            '\\- `/rename` <nome> - Rinomina ticket',
            '\\- `/blacklist` <utente> - Blacklist utente',
            '\\- `/sendtranscript` <id ticket> <utente> - Manda transcript di un ticket in DM'
        ]
    },
    'utility': {
        'emoji': '🔧',
        'name': 'Utilità',
        'commands': [
            '\\- `/ping` - Mostra latenza bot',
            '\\- `/uptime` - Mostra uptime bot',
            '\\- `/purge` <messaggi> - Elimina messaggi',
            '\\- `/delete` - Elimina canale',
            '\\- `/rename_channel` <nome> [canale] - Rinomina canale',
            '\\- `/embed` - Crea embed personalizzato',
            '\\- `/regole` - Manda le regole del server',
            '\\- `/verify panel` - Manda messaggio verifica',
            '\\- `/verify forceverify` <membro> - Verifica forzata per un membro'
        ]
    },
    'autorole': {
        'emoji': '🎭',
        'name': 'AutoRole',
        'commands': [
            '\\- `/createreact` <id messaggio> <emoji> <ruolo> - Crea messaggio reazione ruoli'
        ]
    },
    'fun': {
        'emoji': '🎲',
        'name': 'Fun',
        'commands': [
            '\\- `/coinflip` - Lancia una moneta',
            '\\- `/roll` - Tira un dado',
            '\\- `/avatar` [utente] - Mostra l\'avatar di un utente',
            '\\- `/userinfo` [utente] - Mostra informazioni su un utente',
            '\\- `/serverinfo` - Mostra informazioni sul server',
            '\\- `/marry` <utente> - Sposa un utente',
            '\\- `/divorce` <utente> - Divorzia da un utente',
            '\\- `/relationship` [utente] - Mostra relazioni'
        ]
    },
    'tts': {
        'emoji': '📝',
        'name': 'TTS',
        'commands': [
            '\\- `/tts say` <messaggio> - Usa TTS',
            '\\- `/tts voice` <voce> - Imposta voce',
            '\\- `/tts volume` <volume> - Cambia volume',
            '\\- `/tts stop` - Ferma TTS'
        ]
    },
    'cw': {
        'emoji': '📆',
        'name': 'Clan Wars',
        'commands': [
            '\\- `/cwend` - Termina partita CW',
            '\\- `/ruleset` - Mostra ruleset',
            '\\- `/setruleset` - Imposta ruleset',
            '\\- `/cw` <numero> <data> <ora> <rossi> <verdi> <mappa> <recap> <vincitore> - Invia punteggio CW',
        ]
    },
    'giveaway': {
        'emoji': '🎉',
        'name': 'Giveaway',
        'commands': [
            '\\- `/giveaway create` <premio> <durata> [numero vincitori]- Crea giveaway',
            '\\- `/giveaway remove` <id giveaway> <utente> - Rimuovi forzatamente un membro dal giveaway (solo owner o admin)',
            '\\- `/giveaway reroll` <id giveaway> - Estrai nuovi vincitori aggiuntivi (non sostituisce i precedenti)',
            '\\- `/giveaway end` <id giveaway> - Termina un giveaway immediatamente (solo owner o admin)',
            '\\- `/giveaway blacklist add` <utente> - Impedisci ad utenti di entrare nei giveaway',
            '\\- `/giveaway blacklist remove` <utente> - Permetti ad un utente blacklistato di entrare nei giveaway',
            '\\- `/giveaway blacklist list` - Mostra la blacklist'
        ]
    },
    'bday': {
        'emoji': '🎁',
        'name': 'Birthday',
        'commands': [
            '\\- `/birthday set` <data> - Imposta compleanno',
            '\\- `/birthday remove` - Rimuovi compleanno',
            '\\- `/birthday when` [utente] - Mostra compleanno di un utente',
            '\\- `/birthday next` - Mostra i prossimi compleanni',
        ]
    },
    'rep': {
        'emoji': '✅',
        'name': 'Reputation',
        'commands': [
            '\\- `/rep add` (`+rep`) <utente> [motivo] - Aggiungi reputation',
            '\\- `/rep remove` (`-rep`) <utente> [motivo] - Rimuovi reputation',
            '\\- `/rep show` [utente] - Mostra reputation di un utente',
        ]
    },
    'reminder': {
        'emoji': '🔔',
        'name': 'Reminders',
        'commands': [
            '\\- `/remind add` <quando> <messaggio> [manda in dm] - Crea promemoria',
            '\\- `/remind delete` <id> - Rimuovi promemoria',
            '\\- `/remind list` - Mostra promemoria',
        ]
    },
    'counters': {
        'emoji': '🔢',
        'name': 'Counters',
        'commands': [
            '\\- `/counter start` [tipi] - Crea e avvia i counter (es. total_members,role_members,bots)',
            '\\- `/counter stop` - Ferma ed elimina i counter',
            '\\- `/counter enable` <tipo> [canale] - Abilita un counter su un canale',
            '\\- `/counter disable` <tipo> - Disabilita un counter',
            '\\- `/counter setname` <tipo> <template> - Imposta il nome (usa {count})',
            '\\- `/counter setrole` <ruolo> - Imposta il ruolo per `role_members`',
            '\\- `/counter list` - Elenca i counter attivi',
            '\\- `/counter migrate` - Migra i counter creati con il vecchio sistema (se trovati)'
        ]
    },
    'levels': {
        'emoji': '📈',
        'name': 'Livelli',
        'commands': [
            '`Coming Soon...` 👀',
        ]
    },
    'coralmc': {
        'emoji': '<:VL_CoralMC:1434320425592033391>',
        'name': 'CoralMC',
        'commands': [
            '`Coming Soon...` 👀',
        ]
    },
    'stats': {
        'emoji': '📜',
        'name': 'Stats',
        'commands': [
            '`Coming Soon...` 👀',
        ]
    },
    'logs': {
        'emoji': '⚙️',
        'name': 'Logs',
        'commands': [
            '\\- `/logs` - Visualizza file di log',
            '\\- `/dellogs` - Elimina file di log',
            '\\- `/setlogchannel` [tipo di log] <id canale> - Imposta canali di log'
        ]
    },
    'reload': {
        'emoji': '🔄',
        'name': 'Reload',
        'commands': [
            '\\- `/reloadlog` - Ricarica config di log',
            '\\- `/reloadticket` - Ricarica config di ticket',
            '\\- `/reloadmod` - Ricarica config di moderazione',
            '\\- `/reloadcw` - Ricarica config di CW',
            '\\- `/reloadautorole` - Ricarica config di AutoRole',
            '\\- `/reloadregole` - Ricarica config di regole',
            '\\- `/reloadconfig` - Ricarica config generale',
            '\\- `/reloadall` - Ricarica tutte le configurazioni'
        ]
    }
};

class HelpSelectView {
    constructor(authorId, client) {
        this.authorId = authorId;
        this.client = client;
        this.createdAt = Date.now();
        this.components = this.createComponents();
    }

    createComponents() {
        const options = [
            new StringSelectMenuOptionBuilder()
                .setLabel('Tutti')
                .setValue('all')
                .setEmoji('📋')
        ];

        for (const [key, cat] of Object.entries(categories)) {
            const option = new StringSelectMenuOptionBuilder()
                .setLabel(cat.name)
                .setValue(key)
                .setEmoji(cat.emoji);
            options.push(option);
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_select')
            .setPlaceholder('Seleziona una categoria...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return [row];
    }

    async handleSelectCallback(interaction) {
        try {
            if (interaction.user.id !== this.authorId) {
                await interaction.reply({ content: '❌ Solo chi ha eseguito il comando può usare questo menu!', ephemeral: true });
                return;
            }

            const selected = interaction.values[0];

            const embed = new EmbedBuilder()
                .setTitle('📋 Comandi Disponibili')
                .setColor(0x00ff00);

            if (selected === 'all') {
                embed.setDescription('Ecco una lista di tutti i comandi slash disponibili su questo bot:');
                for (const [key, cat] of Object.entries(categories)) {
                    embed.addFields({
                        name: `${cat.emoji} ${cat.name}`,
                        value: cat.commands.join('\n'),
                        inline: false
                    });
                }
            } else {
                const cat = categories[selected];
                embed.setTitle(`${cat.emoji} ${cat.name}`);
                embed.setDescription(`Comandi disponibili nella categoria **${cat.name}**:`);
                embed.addFields({
                    name: 'Comandi',
                    value: cat.commands.join('\n'),
                    inline: false
                });
            }

            embed.setFooter({ text: 'Valiance Bot | "<campo>" indica un campo obbligatorio; "[campo]" indica un campo opzionale.' });

            await interaction.update({ embeds: [embed], components: this.components });
        } catch (error) {
            logger.error(`Error in help select callback: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Errore nel menu help.', ephemeral: true });
            }
        }
    }
}

class HelpCog {
    constructor(client) {
        this.client = client;
        this.commands = [
            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Mostra una lista di tutti i comandi slash disponibili')
        ];
    }

    async handleHelp(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('📋 Comandi Disponibili')
                .setDescription('**Help** | **Valiance**\n\nBenvenuto nel pannello comandi di **Valiance**.\nQuesto bot è stato progettato per offrire strumenti intuitivi, affidabili e sempre aggiornati per la tua community Discord.\n\nUtilizza il menu sottostante per navigare tra le varie categorie e scoprire tutti i comandi disponibili.\nOgni sezione contiene descrizioni dettagliate e parametri d\'uso per aiutarti a sfruttare al meglio ogni funzione.\n\n⚙️ | Developer: `indifferenzah`\n<:VL_Discord:1437134976217911407> | Discord: https://discord.gg/GVMGZuGZ8F\n🔗 | Sito: https://valiancev2.vercel.app/\n-# 💡 | Per suggerimenti o supporto apri un ticket.')
                .setColor(0x00ff00)
                .setFooter({ text: 'Valiance Bot | "<campo>" indica un campo obbligatorio; "[campo]" indica un campo opzionale.' });

            const view = new HelpSelectView(interaction.user.id, this.client);
            
            // Store the view before replying
            this.client.helpViews = this.client.helpViews || new Map();
            this.client.helpViews.set(interaction.user.id, view);
            
            await interaction.reply({ embeds: [embed], components: view.components, ephemeral: true });
            logger.info(`/help used by ${interaction.user.tag} in ${interaction.guild.name}`);
        } catch (error) {
            logger.error(`Error in help command: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Errore nel comando help.', ephemeral: true });
            }
        }
    }
}

function setup(client) {
    const helpCog = new HelpCog(client);
    
    // Store helpCog reference for interaction handling
    client.helpCog = helpCog;
    
    // Clean up expired views every 5 minutes
    if (!client.helpViewCleanup) {
        client.helpViewCleanup = setInterval(() => {
            if (client.helpViews) {
                const now = Date.now();
                for (const [userId, view] of client.helpViews.entries()) {
                    if (view.createdAt && now - view.createdAt > 15 * 60 * 1000) {
                        client.helpViews.delete(userId);
                    }
                }
            }
        }, 5 * 60 * 1000);
    }

    // Add commands to global commands array
    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...helpCog.commands);

    return helpCog;
}

module.exports = { setup, HelpCog, categories };