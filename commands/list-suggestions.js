const {COLORS} = require('../constants/suggestions.js');
const {getGuildConfig} = require('../guildConfigManager.js');

module.exports = {
	command: 'list-suggestions',
	aliases: [],
	description: 'List the suggestions made for the server.',
	usage: `[all]
	all
		"all" to also show implemented and rejected
		suggestions. Omit to only show open, closed, and
		accepted suggestions.`,
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
			return;
		}

		const messages = await getChannelHistory(suggestionChannel);
		messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

		const acceptedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.ACCEPTED);
		const closedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.CLOSED);
		const openSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.OPEN);
		const rejectedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.REJECTED);
		const implementedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.IMPLEMENTED);

		let text = '';
		text += `**__Closed Suggestions:__** ${closedSuggestions.length}\n`;
		text += closedSuggestions.map((e, i) => `\`${e.embeds[0].title.split(' ')[1]}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
		text += '\n';

		text += `**__Accepted Suggestions:__** ${acceptedSuggestions.length}\n`;
		text += acceptedSuggestions.map((e, i) => `\`${e.embeds[0].title.split(' ')[1]}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
		text += '\n';

		text += `**__Open Suggestions:__** ${openSuggestions.length}\n`;
		text += openSuggestions.map((e, i) => `\`${e.embeds[0].title.split(' ')[1]}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
		text += '\n';

		if (message.content.slice(context.argsOffset).trim().toLowerCase().startsWith('all')) {
			text += `**__Rejected Suggestions:__** ${rejectedSuggestions.length}\n`;
			text += rejectedSuggestions.map((e, i) => `\`${e.embeds[0].title.split(' ')[1]}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
			text += '\n';

			text += `**__Implemented Suggestions:__** ${implementedSuggestions.length}\n`;
			text += implementedSuggestions.map((e, i) => `\`${e.embeds[0].title.split(' ')[1]}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
			text += '\n';
		}

		await message.channel.send(text, {split: true});
	},
};

/**
 * Fetches all messages from a channel
 * @param {*} channel The channel to fetch the messages in
 * @returns {Promise.<Array.<Object>>} An array of all fetched messages
 */
async function getChannelHistory(channel) {
	const result = [];
	let lastMessage;
	let done = false;

	do {
		const options = {limit: 100};
		options.before = lastMessage;

		const messages = await channel.fetchMessages(options);
		if (messages.size) {
			result.push(...messages.values());
			lastMessage = messages.lastKey();
		} else {
			done = true;
		}
	} while (!done);

	return result;
}

function shorten(string) {
	let shortened = string.slice(0, 80);
	if (shortened.includes('\n')) {
		shortened = shortened.split('\n')[0];
	}
	if (shortened !== string) {
		shortened += '…';
	}
	return shortened;
}

function isValidSuggestion(message) {
	return message.embeds[0] && message.embeds[0].title && message.embeds[0].title.startsWith('Suggestion') && message.embeds[0].description;
}
