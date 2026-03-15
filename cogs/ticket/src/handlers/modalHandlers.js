const { MESSAGES } = require('../../constants');
const store = require('../services/ticketStore');
const { openTicketChannel, extractQuestions } = require('./buttonHandlers');

async function handleTicketModal(interaction) {
    const buttonId     = interaction.customId.split(':')[1];
    const buttonConfig = (store.config.ticket_buttons || []).find(b => b.id === buttonId);
    if (!buttonConfig) {
        return interaction.reply({ content: MESSAGES.ERROR.BUTTON_NOT_FOUND, ephemeral: true });
    }

    const questions  = extractQuestions(buttonConfig);
    const answerVars = {};

    for (let i = 0; i < questions.length && i < 5; i++) {
        const fieldId = questions[i].id || `q${i + 1}`;
        let value = '';
        try { value = interaction.fields.getTextInputValue(fieldId) || ''; } catch { /* not filled */ }
        answerVars[`{q${i + 1}}`] = value.trim() || 'N/A';
    }

    await openTicketChannel(interaction, buttonConfig, answerVars);
}

module.exports = { handleTicketModal };
