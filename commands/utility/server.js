const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');


module.exports = {
  cooldown: 10,
	data: new SlashCommandBuilder()
		.setName('serverinfo')
    .setDMPermission(false)
		.setDescription('Provides information about the server.'),
	async execute(interaction) {
		const guild = interaction.guild;

    const serverInfoEmbed = new EmbedBuilder()
      .setTitle(`${guild.name}'s Information`)
      .setColor(guildColours.primary)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: 'Server Name:', value: guild.name, inline: false },
        { name: 'Server ID:', value: guild.id, inline: false },
        { name: 'Owner:', value: `<@${guild.ownerId}>`, inline: false },
        { name: 'Region:', value: guild.preferredLocale, inline: false },
        { name: 'Members:', value: guild.memberCount.toString(), inline: false },
        { name: 'Roles:', value: guild.roles.cache.size.toString(), inline: false },
        { name: 'Channels:', value: guild.channels.cache.size.toString(), inline: false },
        { name: 'Created On:', value: `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:F>`, inline: false },
        { name: 'Boost Level:', value: guild.premiumTier.toString(), inline: false },
        { name: 'Boost Count:', value: guild.premiumSubscriptionCount.toString(), inline: false }
      );

    await interaction.reply({ embeds: [serverInfoEmbed] });
	},
};