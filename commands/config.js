const {getGuildConfig} = require('../guildConfigManager.js');
const {updateGuild} = require('../rememberRoles.js');

module.exports = {
	command: 'config',
	aliases: [],
	description: 'Manage server configuration.',
	usage: '[setting [value]]',
	ownerOnly: false,
	adminOnly: true,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		const config = await getGuildConfig(message.guild.id);

		// if no key is given, print current config
		if (!message.content.slice(context.argsOffset).trim()) {
			await message.channel.send('```' + JSON.stringify(config, null, 2) + '```', {
				split: {
					prepend: '```',
					append: '```',
				},
			});
			return;
		}

		let [key, ...data] = message.content.slice(context.argsOffset).trim().split(' ');
		data = data.join(' ');

		// if key is given, validate and set key
		if (!config.settableKeys.includes(key)) {
			await message.reply(`"${key}" is not a valid key.`);
			return;
		}

		const oldValue = config[key];
		config[key] = data;
		const newValue = config[key];
		try {
			await config.save();
		} catch (err) {
			await message.reply(`could not set "${key}":\n\`\`\`\n${err.message}\n\`\`\``);
			return;
		}

		await message.reply(`"${key}" successfully set.`);

		if (key === 'rememberRoles' && oldValue === false && newValue === true) {
			await updateGuild(message.guild);
		}

		if (key === 'youtubeGuildIconSync' && oldValue === false && newValue === true) {
			config.youtubeAvatarHash = '';
			await config.save();
		}
	},
};
