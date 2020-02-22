const Discord = require('discord.js');
const logger = require('winston').loggers.get('default');
const schedule = require('node-schedule');

const {getGuildConfig} = require('../guildConfigManager.js');
const reactionHandler = require('../reactionHandler.js');
const Suggestion = require('../models/Suggestion.js');
const {CLOSED, OPEN} = require('../constants/suggestions.js').COLORS;

module.exports = {
	command: 'suggest',
	aliases: [],
	description: null,
	usage: null,
	ownerOnly: false,
	adminOnly: false,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		const config = await getGuildConfig(message.guild.id);
		const suggestionChannel = config.suggestionChannel;
		if (!suggestionChannel) {
			await message.channel.send(`${message.author}, suggestions aren't enabled on this server.`);
			return;
		}

		if (config.suggestionRoles.length) {
			const member = await message.guild.fetchMember(message.author);
			if (!config.suggestionRoles.some(e => member.roles.has(e))) {
				await message.channel.send(`${message.author}, you don't have the required roles to use this command.`);
				return;
			}
		}

		const HOUR = 60 * 60 * 1000;
		const endTime = Date.now() + (config.suggestionVoteHours * 60 * 60 * 1000);
		const endHour = endTime + (HOUR - (endTime % HOUR)); // next full hour after endTime

		const suggestionText = message.content.slice(context.argsOffset).trim();
		if (!suggestionText) {
			await message.channel.send(`${message.author}, please enter a suggestion text.`);
			return;
		}

		const lastMessages = await message.channel.fetchMessages({before: message.id});
		const lastSuggestion = lastMessages.find(isValidSuggestion);
		const suggestionId = lastSuggestion ? Number(lastSuggestion.embeds[0].title.split('#')[1]) + 1 || 1 : 1;

		const embed = new Discord.RichEmbed()
			.setColor(OPEN)
			.setTitle(`Suggestion #${suggestionId}`)
			.setDescription(suggestionText)
			.addField('Suggested by', `${message.author} ${message.author.tag}`)
			.addField('Instructions', '👍 = I __**want**__ this to happen.\n🤷 = I __**don\'t care**__ whether this happens.\n👎 = I __**don\'t want**__ this to happen.', true)
			.setFooter('Votes are open until:')
			.setTimestamp(endHour);
		const sentMessage = await suggestionChannel.send(embed);

		const reactions = sentMessage.react('👍').then(() => sentMessage.react('🤷')).then(() => sentMessage.react('👎'));
		reactions.catch(() => {/* noop */}); // prevent "Promise rejection was handled asynchronously" warning

		const suggestion = new Suggestion({
			guildId: sentMessage.guild.id,
			channelId: sentMessage.channel.id,
			messageId: sentMessage.id,
			endTime,
		});
		await suggestion.save();

		const loggingChannel = config.loggingChannel;
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
				const newEmbed = new Discord.RichEmbed()
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

				const config = await getGuildConfig(message.guild.id);
				const loggingChannel = config.loggingChannel;
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

		const config = await getGuildConfig(reaction.message.guild.id);
		// require necessary roles
		if (config.suggestionRoles.length) {
			const member = await reaction.message.guild.fetchMember(user);
			if (!config.suggestionRoles.some(e => member.roles.has(e))) {
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

function isValidSuggestion(message) {
	return message.embeds[0] && message.embeds[0].title && message.embeds[0].title.startsWith('Suggestion') && message.embeds[0].description;
}
