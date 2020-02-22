const commandHandler = require('../commandHandler.js');
const {getGuildConfig} = require('../guildConfigManager.js');

module.exports = {
	name: 'clear-suggestions',
	limited: false,
	ownerOnly: false,
	adminOnly: false,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: true,
	botsOnly: false,
	allowSelf: false,
	test: async message => {
		const config = await getGuildConfig(message.guild.id);
		return config.suggestionChannel && message.channel.id === config.suggestionChannel.id;
	},
	run: async (message, context) => {
		const suggestionCommandRegex = new RegExp(`^(${commandHandler.getGlobalPrefixes().concat(commandHandler.getGuildPrefixes(message.guild.id)).join('|')})suggest`);
		if (!suggestionCommandRegex.test(message.content)) {
			await message.delete();
		}
	},
};
