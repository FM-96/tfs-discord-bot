const commandHandler = require('../commandHandler.js');

const suggestionChannels = {};
for (const guildConfig of process.env.SUGGESTION_CHANNELS.split(',')) {
	const [guild, channel] = guildConfig.split(':');
	suggestionChannels[guild] = channel;
}

module.exports = {
	name: 'clear-suggestions',
	limited: false,
	ownerOnly: false,
	adminOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: true,
	botsOnly: false,
	allowSelf: false,
	test: async message => message.channel.id === suggestionChannels[message.guild.id],
	run: async (message, context) => {
		const suggestionCommandRegex = new RegExp(`^(${commandHandler.getGlobalPrefixes().concat(commandHandler.getGuildPrefixes(message.guild.id)).join('|')})suggest`);
		if (!suggestionCommandRegex.test(message.content)) {
			await message.delete();
		}
	},
};
