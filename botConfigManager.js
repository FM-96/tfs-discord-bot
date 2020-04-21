module.exports = {
	getBotConfig,
	loadBotConfig,
};

const BotConfig = require('./models/BotConfig.js');

let config;

function getBotConfig() {
	if (!config) {
		throw new Error('Bot config not loaded');
	}
	return config;
}

async function loadBotConfig() {
	config = await BotConfig.findOne().exec();
	if (!config) {
		config = new BotConfig();
		await config.save();
	}
	return config;
}
