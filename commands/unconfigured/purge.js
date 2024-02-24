const { SlashCommandBuilder } = require('discord.js');


module.exports = {
  cooldown: 8,
	data: new SlashCommandBuilder()
		.setName('purge')
		.setDescription('Purge up to 999 messages.')
    .setDMPermission(false)
		.addIntegerOption(option =>
			option.setName('amount')
				.setDescription('Number of messages to purge')
				.setMinValue(1)
				.setMaxValue(1000)),
	async execute(interaction) {
		const amount = interaction.options.getInteger('amount');

		try {
			// Reply to the interaction with "Working on it..."
			const workingMessage = await interaction.reply({ content: 'Purging...', ephemeral: true });

			// Bulk delete messages
			const deletedMessages = await interaction.channel.bulkDelete(amount, true);

			// Edit the "Working on it..." message with the final result
			await workingMessage.edit({ content: `Successfully purged \`${deletedMessages.size}\` messages.`, ephemeral: true });
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: 'There was an error purging messages in this channel!', ephemeral: true });
		}
	},
};
