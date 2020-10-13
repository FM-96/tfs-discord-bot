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
	description: 'Make a suggestion for the server.',
	usage: '<suggestion>',
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
		if (!config.suggestionsEnabled) {
			await message.channel.send(`${message.author}, suggestions aren't enabled on this server.`);
			return;
		}
		const suggestionChannel = config.suggestionChannel;
		if (!suggestionChannel) {
			await message.channel.send(`${message.author}, no suggestion channel is set up on this server.`);
			return;
		}

		if (config.suggestionRoles.length) {
			const member = await message.guild.members.fetch(message.author);
			if (!config.suggestionRoles.some(e => member.roles.cache.has(e))) {
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

		let lastSuggestionId = config.suggestionCount;
		if (!lastSuggestionId) {
			const lastMessages = await suggestionChannel.messages.fetch({before: message.id});
			const lastSuggestion = lastMessages.find(isValidSuggestion);
			lastSuggestionId = lastSuggestion ? Number(lastSuggestion.embeds[0].title.split('#')[1]) || 0 : 0;
		}

		const newSuggestionId = lastSuggestionId + 1;
		config.suggestionCount = newSuggestionId;
		await config.save();

		const embed = new Discord.MessageEmbed()
			.setColor(OPEN)
			.setTitle(`Suggestion #${newSuggestionId}`)
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
				const channel = global.client.channels.cache.get(suggestion.channelId);
				if (!channel) {
					logger.warn(`Channel ${suggestion.channelId} no longer accessible`);
					await suggestion.remove();
					continue;
				}
				let message;
				try {
					message = await channel.messages.fetch(suggestion.messageId);
				} catch (err) {
					if (err.message === 'Unknown Message') {
						logger.warn(`Suggestion message ${suggestion.messageId} has been deleted`);
						await suggestion.remove();
						continue;
					}
					throw err;
				}
				const oldEmbed = message.embeds[0];
				const results = {total: 0, caring: 0};
				for (const reaction of message.reactions.cache.array()) {
					if (['👍', '🤷', '👎'].includes(reaction.emoji.name)) {
						if (reaction.partial) {
							await reaction.fetch();
						}
						await reaction.users.fetch();
						const votes = reaction.users.cache.filter(e => !e.bot);
						results[reaction.emoji.name] = votes;
						results.total += votes.size;
						if (reaction.emoji.name !== '🤷') {
							results.caring += votes.size;
						}
					}
				}
				// edit with vote results
				const newEmbed = new Discord.MessageEmbed()
					.setTitle(oldEmbed.title)
					.setDescription(oldEmbed.description)
					.addField('Suggested by', oldEmbed.fields[0].value)
					.addField('Results', ['👍', '🤷', '👎'].map(e => `${e}: ${results[e].size} (${(Math.round((results[e].size / results.total) * 10000) / 100) || 0}%)${e !== '🤷' ? ` [${(Math.round((results[e].size / results.caring) * 10000) / 100) || 0}%]` : ''}`).join('\n') + `\nTotal votes: ${results.total}`, true)
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
				await message.reactions.removeAll();
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
			const member = await reaction.message.guild.members.fetch(user);
			if (!config.suggestionRoles.some(e => member.roles.cache.has(e))) {
				await reaction.users.remove(user);
			}
		}
		// allow only 1 reaction per message per user
		let filterFunc;
		if (reaction.emoji.id) {
			filterFunc = e => e.emoji.id !== reaction.emoji.id;
		} else {
			filterFunc = e => e.emoji.id || e.emoji.name !== reaction.emoji.name;
		}
		const otherReactions = reaction.message.reactions.cache.filter(filterFunc).array();
		await Promise.all(otherReactions.map(e => (e.partial ? e.fetch() : e)));
		await Promise.all(otherReactions.map(e => e.users.fetch()));
		const removals = [];
		for (const otherReaction of otherReactions) {
			if (otherReaction.users.cache.has(user.id)) {
				removals.push(otherReaction.users.remove(user));
			}
		}
		await Promise.all(removals);
	});
}

function isValidSuggestion(message) {
	return message.embeds[0] && message.embeds[0].title && message.embeds[0].title.startsWith('Suggestion') && message.embeds[0].description;
}
