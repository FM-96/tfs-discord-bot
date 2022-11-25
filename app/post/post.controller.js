const jwt = require('jsonwebtoken');

module.exports = {
	postFiles,
};

async function postFiles(req, res) {
	let decoded;
	try {
		decoded = jwt.verify(req.body.jwt, process.env.JWT_SECRET, {algorithms: ['HS256']});
	} catch (err) {
		res.sendStatus(401);
		return;
	}
	if (req.body.clear && !decoded.clear) {
		res.sendStatus(401);
		return;
	}
	if (req.files.map(e => e.fieldname).some(e => !decoded.channels.includes(e))) {
		res.sendStatus(401);
		return;
	}

	const guild = global.client.guilds.cache.get(req.params.guildId);
	if (!guild) {
		res.sendStatus(404);
		return;
	}
	for (const file of req.files) {
		const channel = guild.channels.cache.get(file.fieldname);
		if (!channel) {
			res.sendStatus(404);
			return;
		}

		if (req.body.clear) {
			const oldMsgs = await channel.messages.fetch();
			if (oldMsgs.size > 15) {
				res.status(400).send('Too many messages in channel to delete');
				return;
			}
			await channel.bulkDelete(oldMsgs, true);
			await Promise.all(oldMsgs.filter(e => !e.deleted).map(e => e.delete().catch(() => {/* no-op */})));
		}

		const contents = String(file.buffer);
		const parts = split(contents);

		for (const part of parts) {
			await channel.send(part, {
				allowedMentions: {
					parse: [],
				},
			});
		}
	}
	res.sendStatus(200);
}

// reference: https://github.com/discordjs/discord.js/blob/v12/src/util/Util.js#L64
function split(str) {
	const LENGTH_LIMIT = 1950;

	if (str.length <= LENGTH_LIMIT) {
		return [str];
	}

	const parts = [];
	const lines = str.split('\n');

	if (lines.some(e => e.length > LENGTH_LIMIT)) {
		throw new Error('Cannot split: line too long');
	}

	let newPart = '';
	for (const line of lines) {
		if (newPart.length + line.length > LENGTH_LIMIT) {
			parts.push(newPart);
			newPart = '';
		}
		newPart += line + '\n';
	}
	parts.push(newPart);

	return parts;
}
