module.exports = {
	updateDatabase,
	memberAdd,
	memberUpdate,
};

const Discord = require('discord.js');
const logger = require('winston').loggers.get('default');

const {getGuildConfig} = require('./guildConfigManager.js');
const GuildConfig = require('./models/GuildConfig.js');
const MemberRoles = require('./models/MemberRoles.js');

async function updateDatabase(client) {
	// update member roles database
	logger.debug('Updating member roles database');
	const enabledGuilds = await GuildConfig.find({rememberRoles: true}).exec();
	const saveOps = [];
	for (const guild of enabledGuilds.map(e => client.guilds.get(e.guildId)).filter(e => e)) {
		await guild.fetchMembers();
		let docs = await MemberRoles.find({guildId: guild.id}).exec();

		// don't change documents of members that aren't in the server
		docs = docs.filter(e => guild.member(e.userId));

		// create documents for not yet saved members
		const newMembers = guild.members.array().filter(e => !e.user.bot && e.roles.size && !docs.find(d => d.userId === e.user.id));
		for (const newMember of newMembers) {
			docs.push(new MemberRoles({guildId: guild.id, userId: newMember.user.id, roleIds: []}));
		}

		for (const doc of docs) {
			const memberRoleIds = guild.member(doc.userId).roles.filter(r => !r.managed && r.id !== r.guild.id).map(r => r.id).sort();
			if (memberRoleIds.join() !== doc.roleIds.join()) {
				doc.roleIds = memberRoleIds;
				saveOps.push(doc.save());
			}
		}
	}
	await Promise.all(saveOps);
	logger.info('Finished updating member roles database');
}

async function memberAdd(member) {
	const config = await getGuildConfig(member.guild.id);
	if (!config.rememberRoles) {
		return;
	}

	if (member.user.bot) {
		return;
	}

	const doc = await MemberRoles.findOne({guildId: member.guild.id, userId: member.user.id}).exec();
	if (doc) {
		const rolesToAdd = [];
		for (const roleId of doc.roleIds) {
			const role = member.guild.roles.get(roleId);
			if (role) {
				rolesToAdd.push(role);
			}
		}
		if (rolesToAdd.length) {
			logger.info(`${member.user.username} (${member.user.id}) rejoined, re-adding ${rolesToAdd.length} roles`);
			member.addRoles(rolesToAdd).catch(logger.error);

			const loggingChannel = config.loggingChannel;
			if (loggingChannel) {
				const embed = new Discord.RichEmbed()
					.setAuthor(member.user.tag, member.user.avatarURL)
					.setDescription(`${member} rejoined and was given back the following roles: ${rolesToAdd.map(e => `__${e.name}__`).join(', ')}.`)
					.setColor(0xCC00CC)
					.setFooter(`ID: ${member.id}`)
					.setTimestamp();
				await loggingChannel.send(embed);
			}
		}
	}
}

async function memberUpdate(oldMember, newMember) {
	const config = await getGuildConfig(newMember.guild.id);
	if (!config.rememberRoles) {
		return;
	}

	if (newMember.user.bot) {
		return;
	}

	const oldMemberRoles = oldMember.roles.filter(e => !e.managed && e.id !== e.guild.id).map(e => e.id).sort();
	const newMemberRoles = newMember.roles.filter(e => !e.managed && e.id !== e.guild.id).map(e => e.id).sort();

	if (oldMemberRoles.join() !== newMemberRoles.join()) {
		let doc = await MemberRoles.findOne({guildId: newMember.guild.id, userId: newMember.user.id}).exec();
		doc = doc || new MemberRoles({guildId: newMember.guild.id, userId: newMember.user.id});
		doc.roleIds = newMemberRoles;
		doc.save().catch(logger.error);
	}
}
