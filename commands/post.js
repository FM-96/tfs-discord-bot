const Discord = require('discord.js');
const got = require('got');

const {getGuildConfig} = require('../guildConfigManager.js');

module.exports = {
	command: 'post',
	aliases: [],
	description: 'Have the bot post a message to a specific channel.',
	usage: `<channel> [message]
	channel
		Channel to post the message to.
	message
		The text to post. Can also be omitted and provided
		via attachment instead.
		(If both are provided, the attachment will be used.)`,
	ownerOnly: false,
	adminOnly: true,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		const channelStr = context.argv[0];
		let text = context.argv.slice(1).join(' ').trim();

		const match = /(\d+)|<#(\d+)>/.exec(channelStr);
		if (!match) {
			await message.reply('invalid channel.');
			return;
		}
		const channelId = match[1] || match[2];
		const channel = message.guild.channels.cache.get(channelId);
		if (!channel || !channel.send) {
			await message.reply('invalid channel.');
			return;
		}

		if (message.attachments.first()) {
			text = await got(message.attachments.first().url).text();
		}

		if (!text.trim()) {
			await message.reply('no message text provided.');
			return;
		}

		await channel.send(text, {
			allowedMentions: {
				parse: [],
			},
			split: true,
		});

		const config = await getGuildConfig(message.guild.id);
		const loggingChannel = config.loggingChannel;
		if (loggingChannel) {
			const embed = new Discord.MessageEmbed()
				.setAuthor(message.author.tag, message.author.avatarURL())
				.setTitle('Message Posted')
				.setColor(message.guild.me.displayColor);

			embed.setDescription(`${message.author} (${message.author.id}) posted a message to ${channel}.`);

			await loggingChannel.send({
				embed,
				files: [{
					attachment: Buffer.from(text),
					name: `message_${channel.name}_${new Date().toISOString().replace(/-|:|(?:\.\d+Z)/g, '')}.txt`,
				}],
			});
		}
	},
};
