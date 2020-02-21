module.exports = {
	getGuildConfig,
};

const GuildConfig = require('./models/GuildConfig.js');

/**
 * Gets the configuration for a specific guild
 * @param {String} guildId ID of the guild to get the configuration for
 * @returns {GuildConfig} Configuration of the guild
 */
async function getGuildConfig(guildId) {
	let config = await GuildConfig.findOne({guildId}).exec();
	if (!config) {
		config = new GuildConfig({guildId});
		await config.save();
	}
	return config;
}
