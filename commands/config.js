const {getGuildConfig} = require('../guildConfigManager.js');

module.exports = {
	command: 'config',
	aliases: [],
	description: null,
	usage: null,
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

		config[key] = data;
		try {
			await config.save();
			await message.reply(`"${key}" successfully set.`);
		} catch (err) {
			await message.reply(`could not set "${key}":\n\`\`\`\n${err.message}\n\`\`\``);
		}

		// TODO index guild on rememberRoles change
	},
};
