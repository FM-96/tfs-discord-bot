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
			await message.channel.send(`${message.author}, no suggestion channel is set up on this server.`);
			return;
		}

		const showAll = context.args.toLowerCase().startsWith('all');

		const messages = await getChannelHistory(suggestionChannel);
		messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

		const acceptedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.ACCEPTED);
		const closedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.CLOSED);
		const openSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.OPEN);
		const rejectedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.REJECTED);
		const implementedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.IMPLEMENTED);

		const suggestionStates = [
			{
				title: 'Closed Suggestions',
				list: closedSuggestions,
				condition: () => true,
			},
			{
				title: 'Accepted Suggestions',
				list: acceptedSuggestions,
				condition: () => true,
			},
			{
				title: 'Open Suggestions',
				list: openSuggestions,
				condition: () => true,
			},
			{
				title: 'Rejected Suggestions',
				list: rejectedSuggestions,
				condition: () => showAll,
			},
			{
				title: 'Implemented Suggestions',
				list: implementedSuggestions,
				condition: () => showAll,
			},
		];

		let text = '';
		for (const state of suggestionStates.filter(e => e.condition())) {
			text += `**__${state.title}:__** ${state.list.length}\n`;
			text += state.list.map((e) => {
				let voteCount;
				if (e.embeds[0].color !== COLORS.OPEN) {
					const [up, neutral, down] = ['👍', '🤷', '👎'].map(f => {
						const regex = new RegExp(`${f}: (\\d+)`);
						const match = regex.exec(e.embeds[0].fields[1].value);
						return match ? match[1] : '?';
					});
					voteCount = ` \`[${up}/${neutral}/${down}]\``;
				}
				return `\`${e.embeds[0].title.split(' ')[1]}\`${voteCount || ''} ${shorten(e.embeds[0].description)}\n${e.url}`;
			}).join('\n');
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

		const messages = await channel.messages.fetch(options);
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
