const logger = require('../../utils/logger');
const { handleCwEnd } = require('../commands/handlers/cwCommands');
const { handleSetRuleset, handleRuleset } = require('../commands/handlers/rulesetCommands');
const { handlePing, handleUptime, handlePurge } = require('../commands/handlers/utilityCommands');
const { handleEmbed } = require('../commands/handlers/embedCommands');
const { handleVerify, handleForceVerifyContext } = require('../commands/handlers/verifyCommands');

/**
 * Handler per l'evento interactionCreate
 */
async function onInteractionCreate(client, interaction) {
    // Gestione context menu
    if (interaction.isUserContextMenuCommand()) {
        if (interaction.commandName === 'Force Verify') {
            return handleForceVerifyContext(interaction);
        }
    }

    // Gestione interazioni ticket
    const ticketCog = client.cogs.get('ticket');
    if (ticketCog) {
        if (interaction.isButton()) {
            // Gestione bottoni del pannello ticket (general, partnership, staff, ecc.)
            const ticketButtons = ticketCog.config.ticket_buttons || [];
            const isTicketButton = ticketButtons.some(btn => btn.id === interaction.customId);
            
            if (isTicketButton) {
                await ticketCog.handleTicketButton(interaction);
                return;
            }
            
            // Gestione bottoni interni al ticket
            if (interaction.customId === 'ticket_close') {
                await ticketCog.handleCloseButton(interaction);
                return;
            }
            if (interaction.customId === 'confirm_close') {
                await ticketCog.handleConfirmClose(interaction);
                return;
            }
            if (interaction.customId === 'cancel_close') {
                await ticketCog.handleCancelClose(interaction);
                return;
            }
        }

        if (interaction.isModalSubmit()) {
            // Gestione modal per aprire ticket
            if (interaction.customId.startsWith('ticket_modal:')) {
                await ticketCog.handleTicketModal(interaction);
                return;
            }
        }
    }

    // Gestione pulsante verifica
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
            if (client.verifyView) {
                await client.verifyView.handleVerifyClick(interaction);
            } else {
                await interaction.reply({ content: '❌ Sistema di verifica non configurato.', ephemeral: true });
            }
        }
        return;
    }
    
    // Gestione menu di selezione
    if (interaction.isStringSelectMenu()) {
        try {
            // Menu help
            if (interaction.customId === 'help_select') {
                const helpView = client.helpViews?.get(interaction.user.id);
                if (helpView) {
                    await helpView.handleSelectCallback(interaction);
                    return;
                }
            }
            
            if (interaction.customId === 'embed_creator_select') {
                return;
            }
        } catch (error) {
            logger.error(`Error handling select menu: ${error.message}`);
        }
        return;
    }
    
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'cwend':
                await handleCwEnd(interaction);
                break;
            case 'setruleset':
                await handleSetRuleset(interaction);
                break;
            case 'ruleset':
                await handleRuleset(interaction);
                break;
            case 'purge':
                await handlePurge(interaction);
                break;
            case 'ping':
                await handlePing(interaction);
                break;
            case 'uptime':
                await handleUptime(interaction);
                break;
            case 'embed':
                await handleEmbed(interaction);
                break;
            case 'verify':
                await handleVerify(interaction);
                break;
            case 'help':
                // Gestione comando help
                const helpCog = client.cogs.get('help');
                if (helpCog) {
                    await helpCog.handleHelp(interaction);
                }
                break;
            default:
                // I cog gestiscono i propri comandi tramite i loro listener registrati nel setup
                break;
        }
    } catch (error) {
        logger.error(`Error handling command ${commandName}: ${error.message}`);
        
        const errorMessage = '❌ Si è verificato un errore durante l\'esecuzione del comando.';
        
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (replyError) {
            // Ignora errori se l'interazione è scaduta o il canale non esiste più
            logger.error(`Could not send error message: ${replyError.message}`);
        }
    }
}

module.exports = { onInteractionCreate };
