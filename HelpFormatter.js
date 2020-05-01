const Discord = require('discord.js');

const commandCategories = [
	{
		condition: () => true,
		prop: 'user',
		title: 'User Commands',
	},
	{
		condition: (opts) => opts['isAdmin'],
		prop: 'admin',
		title: 'Admin Commands',
	},
	{
		condition: (opts) => opts['isMod'],
		prop: 'mod',
		title: 'Moderator Commands',
	},
	{
		condition: (opts) => opts['isOwner'],
		prop: 'owner',
		title: 'Owner Commands',
	},
];

class HelpFormatter {
	constructor(prefix, commands) {
		this._prefix = prefix;

		this._commandMap = new Map();
		for (const command of commands) {
			for (const variation of [command.command, ...command.aliases]) {
				this._commandMap.set(variation, command);
			}
		}

		this._commandList = {
			user: commands.filter(e => !e.adminOnly && !e.modOnly && !e.ownerOnly).sort(this._commandSort),
			admin: commands.filter(e => e.adminOnly).sort(this._commandSort),
			mod: commands.filter(e => e.modOnly).sort(this._commandSort),
			owner: commands.filter(e => e.ownerOnly).sort(this._commandSort),
		};
	}

	async commandHelp(guild, command) {
		const commandObj = this._commandMap.get(command);
		if (!commandObj) {
			return false;
		}
		const embed = await this._baseEmbed(guild);
		embed.setTitle(commandObj.command);
		embed.addField('Description', commandObj.description || '*No description provided.*');
		if (commandObj.aliases.length > 0) {
			embed.addField('Aliases', commandObj.aliases.join(', '));
		}
		if (typeof commandObj.usage === 'string') {
			embed.addField('Usage', `\`\`\`${this._prefix}${commandObj.command} ${commandObj.usage}\`\`\``);
		}
		return embed;
	}

	async commandList(guild, options) {
		const embed = await this._baseEmbed(guild);
		embed.setTitle('Command List');
		embed.setDescription(`Use \`${this._prefix}help [command]\` for more information on a command.`);
		for (const category of commandCategories) {
			if (category.condition(options)) {
				let text = '';
				for (const command of this._commandList[category.prop]) {
					text += `\`${this._prefix}${command.command}\` - ${command.description || '*No description provided.*'}\n`;
				}
				if (text) {
					embed.addField(category.title, text);
				}
			}
		}
		return embed;
	}

	async _baseEmbed(guild) {
		const botMember = await guild.fetchMember(guild.client.user);
		return new Discord.RichEmbed().setColor(botMember.displayColor || null);
	}

	_commandSort(a, b) {
		if (a.command < b.command) {
			return -1;
		}
		if (a.command > b.command) {
			return 1;
		}
		return 0;
	}
}

module.exports = HelpFormatter;
