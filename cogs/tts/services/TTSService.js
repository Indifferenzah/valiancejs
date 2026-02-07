const fs = require("fs");
const path = require("path");
const gTTS = require("gtts");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegStatic);

class TTSService {
  constructor(configManager, logger) {
    this.configManager = configManager;
    this.logger = logger;
    this.outputDir = path.join(__dirname, "..", "tmp");
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async synthesize(text, guildId) {
    const language = this.configManager.getLanguage();
    const stamp = `${guildId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mp3Path = path.join(this.outputDir, `tts_${stamp}.mp3`);
    const oggPath = path.join(this.outputDir, `tts_${stamp}.ogg`);

    await this.generateMp3(text, language, mp3Path);
    await this.convertToOggOpus(mp3Path, oggPath);

    return { mp3Path, oggPath };
  }

  generateMp3(text, language, outPath) {
    return new Promise((resolve, reject) => {
      try {
        const tts = new gTTS(text, language);
        tts.save(outPath, (err) => {
          if (err) return reject(err);
          return resolve(outPath);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  convertToOggOpus(mp3Path, oggPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(mp3Path)
        .format("ogg")
        .audioFrequency(48000)
        .audioChannels(2)
        .audioCodec("libopus")
        .on("end", () => resolve(oggPath))
        .on("error", reject)
        .save(oggPath);
    });
  }

  cleanupFiles(files = []) {
    for (const filePath of files) {
      if (!filePath) continue;
      fs.unlink(filePath, (error) => {
        if (error && error.code !== "ENOENT") {
          this.logger?.debug?.(`[TTS] Cleanup failed: ${filePath}`);
        }
      });
    }
  }
}

module.exports = TTSService;
