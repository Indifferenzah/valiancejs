const { SlashCommandBuilder } = require("discord.js");
const { loadJsonSync, saveJsonSync } = require("../../utils/jsonStore");
const path = require("path");

class GangCog {
    constructor(client) {
        this.client = client;
        this.configPath = path.join(__dirname, "gang.json");
        this.config = loadJsonSync(this.configPath, {});

        this.commands = [
            new SlashCommandBuilder()
                .setName("gang")
                .setDescription("Sistema gang - Coming Soon")
        ];
    }

    saveConfig() {
        saveJsonSync(this.configPath, this.config);
    }

    async handleGang(interaction) {
        await interaction.reply({
            content: "🏴‍☠️ Sistema Gang - Coming Soon! 👀",
            ephemeral: true
        });
    }
}

function setup(client) {
    const cog = new GangCog(client);

    client.on("interactionCreate", async interaction => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== "gang") return;

        await cog.handleGang(interaction);
    });

    if (!client.globalCommands) client.globalCommands = [];
    client.globalCommands.push(...cog.commands);

    return cog;
}

module.exports = { setup, GangCog };