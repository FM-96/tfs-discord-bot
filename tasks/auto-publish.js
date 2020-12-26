const {getGuildConfig} = require('../guildConfigManager.js');

module.exports = {
	name: 'auto-publish',
	limited: false,
	ownerOnly: false,
	adminOnly: false,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: true,
	botsOnly: false,
	allowSelf: true,
	test: async message => message.channel.type === 'news',
	run: async (message, context) => {
		const config = await getGuildConfig(message.guild.id);

		if (config.autoPublishChannels.includes(message.channel.id)) {
			await message.crosspost();
		}
	},
};
