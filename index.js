require('dotenv').config();
require('./configureLogger.js');

const discord = require('discord.js');
const logger = require('winston').loggers.get('default');

const client = new discord.Client();

client.once('ready', () => {
	// TODO start YT polling interval
});

client.on('ready', () => {
	logger.info('Successfully logged in');
});

client.login(process.env.BOT_TOKEN).catch(err => {
	logger.fatal('Error logging in:');
	logger.fatal(err);
	process.exit(1);
});
