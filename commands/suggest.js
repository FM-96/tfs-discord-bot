const discord = require('discord.js');
const logger = require('winston').loggers.get('default');
const schedule = require('node-schedule');

const reactionHandler = require('../reactionHandler.js');
const Suggestion = require('../models/Suggestion.js');

const suggestionChannels = {};
for (const guildConfig of process.env.SUGGESTION_CHANNELS.split(',')) {
	const [guild, channel] = guildConfig.split(':');
	suggestionChannels[guild] = channel;
}

module.exports = {
	command: 'suggest',
	aliases: [],
	description: null,
	usage: null,
	ownerOnly: false,
	adminOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		if (message.channel.id !== suggestionChannels[message.guild.id]) {
			if (suggestionChannels[message.guild.id]) {
				await message.channel.send(`${message.author}, suggestions are only allowed in <#${suggestionChannels[message.guild.id]}>.`);
			} else {
				await message.channel.send(`${message.author}, suggestions aren't enabled on this server.`);
			}
			return;
		}

		const HOUR = 60 * 60 * 1000;
		const endTime = Date.now() + (process.env.VOTE_TIME_HOURS * 60 * 60 * 1000);
		const endHour = endTime + (HOUR - (endTime % HOUR)); // next full hour after endTime

		const embed = new discord.RichEmbed()
			.setAuthor(message.author.tag, message.author.avatarURL)
			.setTitle('Suggestion')
			.setDescription(message.content.slice(context.argsOffset).trim())
			.addField('Instructions', '👍 = I **want** this to happen.\n🤷 = I **don\'t care** whether this happens.\n👎 = I **don\'t want** this to happen.')
			.setFooter('Votes are open until:')
			.setTimestamp(endHour);
		const sentMessage = await message.channel.send(embed);
		await message.delete();
		await sentMessage.react('👍');
		await sentMessage.react('🤷');
		await sentMessage.react('👎');

		const suggestion = new Suggestion({
			guildId: sentMessage.guild.id,
			channelId: sentMessage.channel.id,
			messageId: sentMessage.id,
			endTime,
		});
		await suggestion.save();

		// TODO logging
	},
};

if (!module.exports.disabled) {
	schedule.scheduleJob('0 * * * *', async () => {
		try {
			// find expired suggestions
			const suggestions = await Suggestion.find({endTime: {$lt: Date.now()}}).exec();
			for (const suggestion of suggestions) {
				const channel = global.client.channels.get(suggestion.channelId);
				if (!channel) {
					logger.warn(`Channel ${suggestion.channelId} no longer accessible`);
					await suggestion.remove();
					continue;
				}
				let message;
				try {
					message = await channel.fetchMessage(suggestion.messageId);
				} catch (err) {
					if (err.message === 'Unknown Message') {
						logger.warn(`Message ${suggestion.messagelId} has been deleted`);
						await suggestion.remove();
						continue;
					}
					throw err;
				}
				const oldEmbed = message.embeds[0];
				const results = {total: 0};
				for (const reaction of message.reactions.array()) {
					if (['👍', '🤷', '👎'].includes(reaction.emoji.name)) {
						await reaction.fetchUsers();
						const votes = reaction.users.filter(e => !e.bot).size;
						results[reaction.emoji.name] = votes;
						results.total += votes;
					}
				}
				// edit with vote results
				const newEmbed = new discord.RichEmbed()
					.setAuthor(oldEmbed.author.name, oldEmbed.author.iconURL)
					.setTitle(oldEmbed.title)
					.setDescription(oldEmbed.description)
					.addField('Results', ['👍', '🤷', '👎'].map(e => `${e}: ${results[e]} (${Math.round((results[e] / results.total) * 10000) / 100}%)`).join('\n') + `\nTotal votes: ${results.total}`)
					.setFooter('Suggestion closed at:')
					.setTimestamp(oldEmbed.timestamp);
				await message.edit(newEmbed);
				// TODO save exact results
				await message.clearReactions();
				await suggestion.remove();
				// TODO logging
			}
		} catch (err) {
			logger.error('Error when processing suggestions:');
			logger.error(err);
		}
	});

	reactionHandler.addReactionListener('suggest', async (reaction, user) => {
		if (user.id === reaction.message.client.user.id) {
			return;
		}
		const isSuggestion = await Suggestion.exists({messageId: reaction.message.id});
		if (!isSuggestion) {
			return;
		}
		// allow only 1 reaction per message per user
		let filterFunc;
		if (reaction.emoji.id) {
			filterFunc = e => e.emoji.id !== reaction.emoji.id;
		} else {
			filterFunc = e => e.emoji.id || e.emoji.name !== reaction.emoji.name;
		}
		const otherReactions = reaction.message.reactions.filter(filterFunc).array();
		await Promise.all(otherReactions.map(e => e.fetchUsers()));
		const removals = [];
		for (const otherReaction of otherReactions) {
			if (otherReaction.users.has(user.id)) {
				removals.push(otherReaction.remove(user));
			}
		}
		await Promise.all(removals);
	});
}
