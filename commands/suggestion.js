const Discord = require('discord.js');
const logger = require('winston').loggers.get('default');

const {COLORS} = require('../constants/suggestions.js');
const {getGuildConfig} = require('../guildConfigManager.js');

module.exports = {
	command: 'suggestion',
	aliases: [],
	description: 'Edit and/or resolve a suggestion.',
	usage: `<mode> <suggestion message ID> [text]
	mode
		e, edit
			Edits the text of the suggestion. [text] is
			required for this mode.
		a, accepted
		i, implemented
		p, pending
		r, rejected
			Sets the suggestion to the corresponding status.
			[text] is an optional reason/note.`,
	ownerOnly: false,
	adminOnly: true,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		const args = message.content.slice(context.argsOffset).trim().split(' ');
		const mode = args.shift().toLowerCase();
		const targetId = args.shift();
		const text = args.join(' ');

		const config = await getGuildConfig(message.guild.id);

		const suggestionChannel = config.suggestionChannel;
		if (!suggestionChannel) {
			await message.channel.send(`${message.author}, suggestions aren't enabled on this server.`);
			return;
		}

		let targetMessage;
		try {
			targetMessage = await suggestionChannel.fetchMessage(targetId);
		} catch (err) {
			logger.error(err);
			logger.error(err);
			await message.channel.send(`${message.author}, can't find suggestion message.`);
			return;
		}

		if (targetMessage.author.id !== message.client.user.id || !targetMessage.embeds[0] || !targetMessage.embeds[0].title || !targetMessage.embeds[0].title.startsWith('Suggestion')) {
			await message.channel.send(`${message.author}, specified message is not a suggestion.`);
			return;
		}

		const oldEmbed = targetMessage.embeds[0];
		let newEmbed;
		let action = '';

		if (['e', 'edit'].includes(mode)) {
			if (!text) {
				await message.channel.send(`${message.author}, no text provided.`);
				return;
			}
			action = 'Suggestion edited:';
			newEmbed = new Discord.RichEmbed()
				.setColor(oldEmbed.color)
				.setTitle(oldEmbed.title)
				.setDescription(text)
				.addField('Suggested by', oldEmbed.fields[0].value)
				.addField(oldEmbed.fields[1].name, oldEmbed.fields[1].value, true) // instructions or results
				.setFooter(oldEmbed.footer.text)
				.setTimestamp(oldEmbed.timestamp);

			if (oldEmbed.fields[2]) {
				newEmbed.addField(oldEmbed.fields[2].name, oldEmbed.fields[2].value, true); // status
			}
			await targetMessage.edit(newEmbed);
		} else if (['a', 'accepted'].includes(mode)) {
			action = 'Suggestion accepted:';
			newEmbed = new Discord.RichEmbed()
				.setColor(COLORS.ACCEPTED)
				.setTitle(oldEmbed.title)
				.setDescription(oldEmbed.description)
				.addField('Suggested by', oldEmbed.fields[0].value)
				.addField(oldEmbed.fields[1].name, oldEmbed.fields[1].value, true) // instructions or results
				.addField('Status', `__**Accepted**__\n${text}`, true)
				.setFooter(oldEmbed.footer.text)
				.setTimestamp(oldEmbed.timestamp);
			await targetMessage.edit(newEmbed);
		} else if (['i', 'implemented'].includes(mode)) {
			action = 'Suggestion implemented:';
			newEmbed = new Discord.RichEmbed()
				.setColor(COLORS.IMPLEMENTED)
				.setTitle(oldEmbed.title)
				.setDescription(oldEmbed.description)
				.addField('Suggested by', oldEmbed.fields[0].value)
				.addField(oldEmbed.fields[1].name, oldEmbed.fields[1].value, true) // instructions or results
				.addField('Status', `__**Implemented**__\n${text}`, true)
				.setFooter(oldEmbed.footer.text)
				.setTimestamp(oldEmbed.timestamp);
			await targetMessage.edit(newEmbed);
		} else if (['p', 'pending'].includes(mode)) {
			action = 'Suggestion returned to pending:';
			newEmbed = new Discord.RichEmbed()
				.setColor(oldEmbed.fields[1].name === 'Instructions' ? COLORS.OPEN : COLORS.CLOSED)
				.setTitle(oldEmbed.title)
				.setDescription(oldEmbed.description)
				.addField('Suggested by', oldEmbed.fields[0].value)
				.addField(oldEmbed.fields[1].name, oldEmbed.fields[1].value, true) // instructions or results
				.setFooter(oldEmbed.footer.text)
				.setTimestamp(oldEmbed.timestamp);
			await targetMessage.edit(newEmbed);
		} else if (['r', 'rejected'].includes(mode)) {
			action = 'Suggestion rejected:';
			newEmbed = new Discord.RichEmbed()
				.setColor(COLORS.REJECTED)
				.setTitle(oldEmbed.title)
				.setDescription(oldEmbed.description)
				.addField('Suggested by', oldEmbed.fields[0].value)
				.addField(oldEmbed.fields[1].name, oldEmbed.fields[1].value, true) // instructions or results
				.addField('Status', `__**Rejected**__\n${text}`, true)
				.setFooter(oldEmbed.footer.text)
				.setTimestamp(oldEmbed.timestamp);
			await targetMessage.edit(newEmbed);
		} else {
			await message.channel.send(`${message.author}, invalid mode. Valid modes are: ${['edit', 'accepted', 'implemented', 'pending', 'rejected'].map(e => '`' + e + '`').join(', ')}.`);
			return;
		}

		if (newEmbed) {
			await message.channel.send(action, newEmbed);
			const loggingChannel = config.loggingChannel;
			if (loggingChannel) {
				newEmbed.fields[0].value = newEmbed.fields[0].value.replace(/$/, ` (${message.author.id})`); // add suggester ID
				await loggingChannel.send(action, newEmbed);
			}
		}
	},
};
