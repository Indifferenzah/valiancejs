const { SlashCommandBuilder } = require("discord.js");
const { loadJsonSync, saveJsonSync } = require("../../utils/jsonStore");
const path = require("path");

class StatsCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, "stats.json");
        this.config = loadJsonSync(this.configPath, {});

        this.commands = [
            new SlashCommandBuilder()
                .setName("stats")
                .setDescription("Sistema statistiche - Coming Soon")
        ];
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    async handleStats(interaction) {
        await interaction.reply({
            content: "📊 Sistema Stats - Coming Soon! 👀",
            ephemeral: true
        });
    }
}

function setup(client) {
    const cog = new StatsCog(client);

    client.on("interactionCreate", async interaction => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "stats") return;

        await cog.handleStats(interaction);
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.commands);

    return cog;
}

module.exports = { setup, StatsCog };