/**
 * Classe che rappresenta una sessione di gioco
 */
class GameSession {
    constructor(guild, lobbyChannel) {
        this.guild = guild;
        this.lobbyChannel = lobbyChannel;
        this.textChannel = null;
        this.redVoice = null;
        this.greenVoice = null;
        this.taggedUsers = [];
        this.isActive = false;
    }
}

module.exports = { GameSession };
