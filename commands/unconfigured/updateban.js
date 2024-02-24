const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { botColours } = require('../../botColours.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('updateban')
    .setDescription('Updates the reason for a banned user.')
    .addStringOption(option => 
      option.setName('user')
        .setDescription('The ID of the user whose ban reason you want to update')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('newreason')
        .setDescription('The new reason for the ban')
        .setRequired(true)
    ),
  async execute(interaction) {
    // Get options
    const userId = interaction.options.getString('user');
    const newReason = interaction.options.getString('newreason');

    // Fetch existing bans from the guild
    const banList = await interaction.guild.bans.fetch();

    // Check if the user is banned
    const bannedUser = banList.find(banInfo => banInfo.user.id === userId);
    if (!bannedUser) {

      const notBannedEmbed = new EmbedBuilder()
      .setColor(botColours.red)
      .setTitle('Error')
      .setDescription(`${userId} is not banned.`)
      
      await interaction.reply({ embeds: [notBannedEmbed] });
      return;
    }

    // Unban and then re-ban with the new reason
    try {
      await interaction.guild.members.unban(userId);
      await interaction.guild.members.ban(userId, { reason: newReason });

      const sucessfulChangeEmbed = new EmbedBuilder()
      .setColor(botColours.green)
      .setTitle('Ban Reason Updated')
      .setDescription(`The ban reason for ${bannedUser.user.tag} has been updated to: \`${newReason}\``)
      await interaction.reply({ embeds: [sucessfulChangeEmbed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while updating the ban reason.', ephemeral: true });
    }
  },
};
