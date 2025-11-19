const fs = require('fs').promises;
const path = require('path');

async function loadJson(filePath, defaultValue = {}) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return defaultValue;
        }
        throw error;
    }
}

async function saveJson(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        throw error;
    }
}

function loadJsonSync(filePath, defaultValue = {}) {
    try {
        const data = require('fs').readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return defaultValue;
        }
        throw error;
    }
}

function saveJsonSync(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        require('fs').mkdirSync(dir, { recursive: true });
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        throw error;
    }
}

module.exports = {
    loadJson,
    saveJson,
    loadJsonSync,
    saveJsonSync
};