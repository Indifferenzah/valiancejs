const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Valiance Bot Cogs...\n');

const cogsToTest = [
    'ticket/ticket',
    'moderation/moderation', 
    'autorole/autorole',
    'log/log',
    'fun/fun',
    'regole/regole',
    'tts/tts',
    'cw/cw',
    'giveaway/giveaway',
    'help/help',
    'levels/levels',
    'util/reminders',
    'social/marriage',
    'rep/reputation',
    'birthdays/birthdays',
    'counters/counters',
    'stats/stats',
    'gang/gang'
];

let allPassed = true;

for (const cogPath of cogsToTest) {
    const cogFile = path.join(__dirname, 'cogs', `${cogPath}.js`);
    const cogName = cogPath.split('/').pop();
    
    try {
        if (!fs.existsSync(cogFile)) {
            console.log(`❌ ${cogName}: File not found (${cogFile})`);
            allPassed = false;
            continue;
        }

        // Try to require the cog
        const cog = require(cogFile);
        
        if (!cog.setup) {
            console.log(`❌ ${cogName}: Missing setup function`);
            allPassed = false;
            continue;
        }

        // Check if it's a function
        if (typeof cog.setup !== 'function') {
            console.log(`❌ ${cogName}: setup is not a function`);
            allPassed = false;
            continue;
        }

        console.log(`✅ ${cogName}: OK`);
        
    } catch (error) {
        console.log(`❌ ${cogName}: Error loading - ${error.message}`);
        allPassed = false;
    }
}

console.log('\n📊 Test Results:');
if (allPassed) {
    console.log('🎉 All cogs passed the test!');
    console.log('✅ The bot should start successfully.');
} else {
    console.log('⚠️  Some cogs have issues. Please fix them before starting the bot.');
}

// Test required files
console.log('\n🔍 Testing required files...');

const requiredFiles = [
    'index.js',
    'config.json',
    '.env',
    'package.json',
    'utils/logger.js',
    'utils/botUtils.js',
    'utils/jsonStore.js'
];

let filesOk = true;

for (const file of requiredFiles) {
    if (fs.existsSync(path.join(__dirname, file))) {
        console.log(`✅ ${file}: Found`);
    } else {
        console.log(`❌ ${file}: Missing`);
        filesOk = false;
    }
}

if (filesOk) {
    console.log('\n✅ All required files are present!');
} else {
    console.log('\n❌ Some required files are missing!');
}

console.log('\n🚀 Ready to start the bot with: npm start');