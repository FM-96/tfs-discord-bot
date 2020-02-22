const got = require('got');

const {getGuildConfig} = require('../guildConfigManager.js');

module.exports = {
	command: 'check-roles',
	aliases: [],
	description: null,
	usage: null,
	ownerOnly: false,
	adminOnly: true,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		// fetch levels
		let page = 0;
		const leaderboard = new Map();
		let resultLength;
		do {
			const body = await got(`https://mee6.xyz/api/plugins/levels/leaderboard/${message.guild.id}?page=${page++}`).json();
			resultLength = body.players.length;
			body.players.forEach(e => leaderboard.set(e.id, e.level));
		} while (resultLength === 100);

		const config = await getGuildConfig(message.guild.id);

		const results = {
			excluded: [],
			wrongRoles: [],
		};

		// iterate over all members
		await message.guild.fetchMembers();
		for (const member of message.guild.members.array()) {
			const memberLevel = leaderboard.get(member.id) || 0;

			const reached = config.levelUpRoles.filter(e => e.level <= memberLevel);
			const highestReachedLevel = reached.reduce((acc, cur) => Math.max(acc, cur.level), 0);
			const highestReachedRoles = reached.filter(e => e.level === highestReachedLevel).map(e => e.role);
			const otherRoles = config.levelUpRoles.filter(e => e.level !== highestReachedLevel).map(e => e.role);

			if (config.levelUpExcludedRoles.some(e => member.roles.has(e))) {
				const rolesToRemove = config.levelUpRoles.map(e => e.role).filter(e => member.roles.has(e.id));
				if (rolesToRemove.length) {
					results.excluded.push({id: member.id, level: memberLevel, remove: rolesToRemove});
				}
				continue;
			}
			const rolesToAdd = highestReachedRoles.filter(e => !member.roles.has(e.id));
			const rolesToRemove = otherRoles.filter(e => member.roles.has(e.id));

			if (rolesToAdd.length || rolesToRemove.length) {
				results.wrongRoles.push({id: member.id, level: memberLevel, add: rolesToAdd, remove: rolesToRemove});
			}
		}

		if (message.content.slice(context.argsOffset).trim().toLowerCase() === 'fix') {
			if (!(results.excluded.length || results.wrongRoles.length)) {
				await message.channel.send('Nothing to fix.');
				return;
			}
			let messageText = '';
			if (results.excluded.length) {
				messageText += `Fixed ${results.excluded.length} ${results.excluded.length === 1 ? 'person' : 'people'} that should have been excluded.\n`;
				for (const entry of results.excluded) {
					const member = message.guild.members.get(entry.id);
					await member.removeRoles(entry.remove);
				}
			}
			if (results.wrongRoles.length) {
				messageText += `Fixed ${results.wrongRoles.length} ${results.wrongRoles.length === 1 ? 'person' : 'people'} that had wrong roles.\n`;
				for (const entry of results.wrongRoles) {
					const member = message.guild.members.get(entry.id);
					await member.addRoles(entry.add);
					await member.removeRoles(entry.remove);
				}
			}
			await message.channel.send(messageText);
		} else {
			if (!(results.excluded.length || results.wrongRoles.length)) {
				await message.channel.send('All roles are correct.');
				return;
			}
			let messageText = '';
			if (results.excluded.length) {
				messageText += `${results.excluded.length} ${results.excluded.length === 1 ? 'person' : 'people'} should be excluded:\n`;
				messageText += `\`\`\`\n${results.excluded.map(e => `${message.guild.members.get(e.id).user.tag} (${e.id}): ${e.remove.map(f => `-${f.name}`).join(', ')}`).join('\n\u200b')}\n\`\`\`\n`;
			}
			if (results.wrongRoles.length) {
				results.wrongRoles.sort((a, b) => b.level - a.level);
				messageText += `${results.wrongRoles.length} ${results.wrongRoles.length === 1 ? 'person has' : 'people have'} wrong roles:\n`;
				messageText += `\`\`\`\n${results.wrongRoles.map(e => `${message.guild.members.get(e.id).user.tag} (${e.id}) [lvl ${e.level}]: ${e.add.map(f => `+${f.name}`).concat(e.remove.map(f => `-${f.name}`)).join(', ')}`).join('\n\u200b')}\n\`\`\`\n`;
			}
			await message.channel.send(messageText, {
				split: {
					char: '\u200b',
					prepend: '```',
					append: '```',
				},
			});
		}
	},
};
