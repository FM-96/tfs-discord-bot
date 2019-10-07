const VERSION = 'v' + require('../package.json').version + (process.env.NODE_ENV === 'production' ? '' : '-dev'); // eslint-disable-line global-require

module.exports = {
	command: 'version',
	aliases: [],
	description: null,
	usage: null,
	ownerOnly: false,
	adminOnly: false,
	inGuilds: true,
	inDms: true,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		await message.channel.send(VERSION);
	},
};
