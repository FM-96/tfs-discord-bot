const Discord = require('discord.js');

const {getGuildConfig} = require('../guildConfigManager.js');

module.exports = {
	name: 'levelup-role',
	limited: false,
	ownerOnly: false,
	adminOnly: false,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: true,
	botsOnly: false,
	allowSelf: false,
	test: async message => true,
	run: async (message, context) => {
		const config = await getGuildConfig(message.guild.id);

		if (!config.levelUpEnabled || message.author.id !== config.levelUpBot || !config.levelUpRoles.length) {
			return;
		}

		const levelUpRegex = new RegExp(config.levelUpMessage);
		const match = message.content.match(levelUpRegex);
		if (!match) {
			return;
		}

		const [, userId, newLevel] = match;

		const reached = config.levelUpRoles.filter(e => e.level <= newLevel);
		const highestReachedLevel = reached.reduce((acc, cur) => Math.max(acc, cur.level), 0);
		const highestReachedRoles = reached.filter(e => e.level === highestReachedLevel).map(e => e.role);
		const otherRoles = config.levelUpRoles.filter(e => e.level !== highestReachedLevel).map(e => e.role);

		const user = await message.client.fetchUser(userId);
		const member = await message.guild.fetchMember(user);

		if (config.levelUpExcludedRoles.some(e => member.roles.has(e))) {
			await member.removeRoles(config.levelUpRoles.map(e => e.role).filter(e => member.roles.has(e.id)));
			return;
		}
		const rolesToAdd = highestReachedRoles.filter(e => !member.roles.has(e.id));
		const rolesToRemove = otherRoles.filter(e => member.roles.has(e.id));
		if (rolesToAdd.length) {
			await member.addRoles(rolesToAdd);
		}
		if (rolesToRemove.length) {
			await member.removeRoles(rolesToRemove);
		}

		if (!(rolesToAdd.length || rolesToRemove.length)) {
			return;
		}

		const loggingChannel = config.loggingChannel;
		if (loggingChannel) {
			const embed = new Discord.RichEmbed()
				.setAuthor(user.tag, user.avatarURL)
				.setDescription(`${member} reached level ${newLevel}.\nAdded roles: ${rolesToAdd.join(', ')}\nRemoved roles: ${rolesToRemove.join(', ')}`)
				.setColor(member.displayColor)
				.setFooter(`ID: ${user.id}`)
				.setTimestamp();
			await loggingChannel.send(embed);
		}
	},
};
