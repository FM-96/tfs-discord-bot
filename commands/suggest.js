const discord = require('discord.js');
const logger = require('winston').loggers.get('default');
const schedule = require('node-schedule');

const reactionHandler = require('../reactionHandler.js');
const Suggestion = require('../models/Suggestion.js');
const {CLOSED, OPEN} = require('../constants/suggestions.js').COLORS;

const suggestionChannels = {};
for (const guildConfig of process.env.SUGGESTION_CHANNELS.split(',')) {
	const [guild, channel] = guildConfig.split(':');
	suggestionChannels[guild] = channel;
}

const loggingChannels = {};
for (const guildConfig of process.env.LOGGING_CHANNELS.split(',')) {
	const [guild, channel] = guildConfig.split(':');
	loggingChannels[guild] = channel;
}

const suggestionRoles = {};
for (const guildConfig of process.env.SUGGESTION_ROLES.split(',')) {
	const [guild, roles] = guildConfig.split(':');
	suggestionRoles[guild] = roles.split(' ');
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

		if (suggestionRoles[message.guild.id]) {
			const member = await message.guild.fetchMember(message.author);
			if (!suggestionRoles[message.guild.id].some(e => member.roles.has(e))) {
				await message.channel.send(`${message.author}, you don't have the required roles to use this command.`);
				return;
			}
		}

		const HOUR = 60 * 60 * 1000;
		const endTime = Date.now() + (process.env.VOTE_TIME_HOURS * 60 * 60 * 1000);
		const endHour = endTime + (HOUR - (endTime % HOUR)); // next full hour after endTime

		const suggestionText = message.content.slice(context.argsOffset).trim();
		if (!suggestionText) {
			const reply = await message.channel.send(`${message.author}, please enter a suggestion text.`);
			await Promise.all([message.delete(), reply.delete(5000)]);
			return;
		}

		const embed = new discord.RichEmbed()
			.setColor(OPEN)
			.setTitle('Suggestion')
			.setDescription(suggestionText)
			.addField('Suggested by', `${message.author} ${message.author.tag}`)
			.addField('Instructions', '👍 = I __**want**__ this to happen.\n🤷 = I __**don\'t care**__ whether this happens.\n👎 = I __**don\'t want**__ this to happen.', true)
			.setFooter('Votes are open until:')
			.setTimestamp(endHour);
		const sentMessage = await message.channel.send(embed);
		await message.delete();

		const reactions = sentMessage.react('👍').then(() => sentMessage.react('🤷')).then(() => sentMessage.react('👎'));
		reactions.catch(() => {/* noop */}); // prevent "Promise rejection was handled asynchronously" warning

		const suggestion = new Suggestion({
			guildId: sentMessage.guild.id,
			channelId: sentMessage.channel.id,
			messageId: sentMessage.id,
			endTime,
		});
		await suggestion.save();

		const loggingChannel = message.client.channels.get(loggingChannels[message.guild.id]);
		if (loggingChannel) {
			embed.fields[0].value = embed.fields[0].value.replace(/$/, ` (${message.author.id})`); // add suggester ID
			embed.fields.splice(1, 1); // remove instructions field
			await loggingChannel.send(embed);
		}

		await reactions;
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
						logger.warn(`Suggestion message ${suggestion.messageId} has been deleted`);
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
						const votes = reaction.users.filter(e => !e.bot);
						results[reaction.emoji.name] = votes;
						results.total += votes.size;
					}
				}
				// edit with vote results
				const newEmbed = new discord.RichEmbed()
					.setTitle(oldEmbed.title)
					.setDescription(oldEmbed.description)
					.addField('Suggested by', oldEmbed.fields[0].value)
					.addField('Results', ['👍', '🤷', '👎'].map(e => `${e}: ${results[e].size} (${Math.round((results[e].size / results.total) * 10000) / 100}%)`).join('\n') + `\nTotal votes: ${results.total}`, true)
					.setFooter('Votes closed at:')
					.setTimestamp(oldEmbed.timestamp);

				if (oldEmbed.fields[2]) { // if the embed has a status set
					newEmbed
						.setColor(oldEmbed.color)
						.addField(oldEmbed.fields[2].name, oldEmbed.fields[2].value, true); // status
				} else {
					newEmbed.setColor(CLOSED);
				}

				await message.edit(newEmbed);
				await message.clearReactions();
				await suggestion.remove();

				const loggingChannel = message.client.channels.get(loggingChannels[message.guild.id]);
				if (loggingChannel) {
					const fullResults = ['👍', '🤷', '👎'].map((e, i) => `${['+1', 'shrug', '-1'][i]}:\n` + results[e].map(f => `${f.tag} (${f.id})`).join('\n')).join('\n\n');
					newEmbed.fields[0].value = newEmbed.fields[0].value.replace(/$/, ` (${message.author.id})`); // add suggester ID
					await loggingChannel.send({
						embed: newEmbed,
						files: [{
							attachment: Buffer.from(fullResults),
							name: `votes-${message.id}.txt`,
						}],
					});
				}
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
		// require necessary roles
		if (suggestionRoles[reaction.message.guild.id]) {
			const member = await reaction.message.guild.fetchMember(user);
			if (!suggestionRoles[reaction.message.guild.id].some(e => member.roles.has(e))) {
				await reaction.remove(user);
			}
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
