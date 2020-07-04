const {getCommands} = require('command-handler');

const {getGuildConfig} = require('../guildConfigManager.js');
const HelpFormatter = require('../HelpFormatter.js');

let formatter;

module.exports = {
	command: 'help',
	aliases: [],
	description: 'List commands or show detailed help for a command.',
	usage: '[command]',
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
		formatter = formatter || new HelpFormatter(process.env.PREFIX, getCommands());

		const isAdmin = message.member.hasPermission('ADMINISTRATOR');
		const isMod = isAdmin || message.member.roles.some(e => config.modRoles.includes(e.id));
		const isOwner = message.author.id === process.env.OWNER_ID;

		if (context.args) {
			const embed = await formatter.commandHelp(message.guild, context.args);
			if (!embed) {
				await message.channel.send(`Command "${context.args}" not found.`);
				return;
			}
			await message.channel.send(embed);
		} else {
			const embed = await formatter.commandList(message.guild, {isAdmin, isMod, isOwner});
			await message.channel.send(embed);
		}
	},
};
