const logger = require('winston').loggers.get('default');

module.exports = {
	command: 'restart',
	aliases: [],
	description: 'Restart the bot.',
	usage: '',
	ownerOnly: true,
	adminOnly: false,
	modOnly: false,
	inGuilds: true,
	inDms: true,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		logger.info('Restarting via commmand');
		await message.client.destroy();
		process.exit(2);
	},
};
