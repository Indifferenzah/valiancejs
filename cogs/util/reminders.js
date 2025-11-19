const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { loadJsonSync, saveJsonSync } = require("../../utils/jsonStore");
const path = require("path");

class RemindersCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, "config.json");
        this.config = loadJsonSync(this.configPath, { reminders: [] });
        this.activeReminders = new Map();

        this.commands = [
            new SlashCommandBuilder()
                .setName("remind")
                .setDescription("Sistema promemoria")
                .addSubcommand(sub =>
                    sub.setName("add")
                        .setDescription("Crea un promemoria")
                        .addStringOption(opt =>
                            opt.setName("quando")
                                .setDescription("Quando ricordare (es: 1h, 30m, 2d)")
                                .setRequired(true)
                        )
                        .addStringOption(opt =>
                            opt.setName("messaggio")
                                .setDescription("Messaggio del promemoria")
                                .setRequired(true)
                        )
                        .addBooleanOption(opt =>
                            opt.setName("dm")
                                .setDescription("Invia in DM invece che nel canale")
                                .setRequired(false)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName("list")
                        .setDescription("Mostra i tuoi promemoria")
                )
                .addSubcommand(sub =>
                    sub.setName("delete")
                        .setDescription("Elimina un promemoria")
                        .addIntegerOption(opt =>
                            opt.setName("id")
                                .setDescription("ID del promemoria da eliminare")
                                .setRequired(true)
                        )
                )
        ];

        this.setupReminders();
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    parseTime(timeStr) {
        const regex = /(\d+)([smhd])/g;
        let totalMs = 0;
        let match;

        while ((match = regex.exec(timeStr)) !== null) {
            const value = parseInt(match[1]);
            const unit = match[2];

            switch (unit) {
                case 's': totalMs += value * 1000; break;
                case 'm': totalMs += value * 60 * 1000; break;
                case 'h': totalMs += value * 60 * 60 * 1000; break;
                case 'd': totalMs += value * 24 * 60 * 60 * 1000; break;
            }
        }

        return totalMs;
    }

    setupReminders() {
        const now = Date.now();
        
        for (const reminder of this.config.reminders) {
            if (reminder.time > now) {
                const timeout = setTimeout(() => {
                    this.executeReminder(reminder);
                }, reminder.time - now);
                
                this.activeReminders.set(reminder.id, timeout);
            }
        }
    }

    async executeReminder(reminder) {
        try {
            const user = await this.client.users.fetch(reminder.userId);
            const embed = new EmbedBuilder()
                .setTitle("🔔 Promemoria")
                .setDescription(reminder.message)
                .setColor(0x00ff00)
                .setTimestamp();

            if (reminder.dm) {
                await user.send({ embeds: [embed] });
            } else {
                const channel = await this.client.channels.fetch(reminder.channelId);
                if (channel) {
                    await channel.send({ content: `${user.toString()}`, embeds: [embed] });
                }
            }
        } catch (error) {
            console.error(`Error executing reminder ${reminder.id}:`, error);
        }

        // Remove from config and active reminders
        this.config.reminders = this.config.reminders.filter(r => r.id !== reminder.id);
        this.activeReminders.delete(reminder.id);
        this.saveConfig();
    }

    async handleAdd(interaction) {
        const quando = interaction.options.getString("quando");
        const messaggio = interaction.options.getString("messaggio");
        const dm = interaction.options.getBoolean("dm") || false;

        const timeMs = this.parseTime(quando);
        if (timeMs === 0) {
            return interaction.reply({
                content: "❌ Formato tempo non valido! Usa: 1s, 30m, 2h, 1d",
                ephemeral: true
            });
        }

        const remindTime = Date.now() + timeMs;
        const reminderId = Date.now();

        const reminder = {
            id: reminderId,
            userId: interaction.user.id,
            channelId: interaction.channel.id,
            message: messaggio,
            time: remindTime,
            dm: dm
        };

        this.config.reminders.push(reminder);
        this.saveConfig();

        // Set timeout
        const timeout = setTimeout(() => {
            this.executeReminder(reminder);
        }, timeMs);
        
        this.activeReminders.set(reminderId, timeout);

        const embed = new EmbedBuilder()
            .setTitle("✅ Promemoria Creato")
            .setDescription(`Ti ricorderò: **${messaggio}**`)
            .addFields(
                { name: "📅 Quando", value: `<t:${Math.floor(remindTime / 1000)}:R>`, inline: true },
                { name: "📍 Dove", value: dm ? "DM" : `<#${interaction.channel.id}>`, inline: true },
                { name: "🆔 ID", value: reminderId.toString(), inline: true }
            )
            .setColor(0x00ff00);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handleList(interaction) {
        const userReminders = this.config.reminders.filter(r => r.userId === interaction.user.id);

        if (userReminders.length === 0) {
            return interaction.reply({
                content: "📭 Non hai promemoria attivi.",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("🔔 I Tuoi Promemoria")
            .setColor(0x00ff00);

        for (const reminder of userReminders.slice(0, 10)) {
            embed.addFields({
                name: `ID: ${reminder.id}`,
                value: `**Messaggio:** ${reminder.message}\n**Quando:** <t:${Math.floor(reminder.time / 1000)}:R>\n**Dove:** ${reminder.dm ? "DM" : `<#${reminder.channelId}>`}`,
                inline: false
            });
        }

        if (userReminders.length > 10) {
            embed.setFooter({ text: `Mostrati 10 di ${userReminders.length} promemoria` });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handleDelete(interaction) {
        const id = interaction.options.getInteger("id");
        const reminderIndex = this.config.reminders.findIndex(r => r.id === id && r.userId === interaction.user.id);

        if (reminderIndex === -1) {
            return interaction.reply({
                content: "❌ Promemoria non trovato o non è tuo.",
                ephemeral: true
            });
        }

        // Clear timeout
        if (this.activeReminders.has(id)) {
            clearTimeout(this.activeReminders.get(id));
            this.activeReminders.delete(id);
        }

        // Remove from config
        this.config.reminders.splice(reminderIndex, 1);
        this.saveConfig();

        await interaction.reply({
            content: `✅ Promemoria **${id}** eliminato.`,
            ephemeral: true
        });
    }
}

function setup(client) {
    const cog = new RemindersCog(client);

    client.on("interactionCreate", async interaction => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "remind") return;

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case "add":
                    await cog.handleAdd(interaction);
                    break;
                case "list":
                    await cog.handleList(interaction);
                    break;
                case "delete":
                    await cog.handleDelete(interaction);
                    break;
            }
        } catch (error) {
            console.error(`Error in remind command:`, error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: "❌ Si è verificato un errore.",
                    ephemeral: true
                });
            }
        }
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.commands);

    return cog;
}

module.exports = { setup, RemindersCog };