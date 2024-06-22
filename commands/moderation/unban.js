const { SlashCommandBuilder, EmbedBuilder, DiscordAPIError, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildSettings, logPunishment } = require('../../database.js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans the specified user')
    .setDMPermission(false)
    .addStringOption(option => option.setName('user_id').setDescription('The ID of the user to unban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for unbanning the user').setRequired(false)),
  permission: ['banRoles', 'adminRoles', 'godRoles'],
  async execute(interaction) {
    const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
    try {
      const userId = interaction.options.getString('user_id');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const guildId = interaction.guild.id;

      const bans = await interaction.guild.bans.fetch();
      const bannedUser = bans.find(banInfo => banInfo.user.id === userId);

      console.log(guildId)
      
      if (!bannedUser) {
        const notBannedEmbed = new EmbedBuilder()
          .setTitle('User is not banned')
          .setDescription(`The user with ID \`${userId}\` is not banned.`)
          .setColor(guildColours.warning);

        return interaction.reply({ embeds: [notBannedEmbed], ephemeral: true });
      }

      await interaction.guild.bans.remove(userId, reason);

      const punishmentId = uuidv4().replace(/-/g, '');
      await logPunishment(punishmentId, guildId, userId, 'Unban', reason, interaction.user.id, Date.now());

      const unbannedEmbed = new EmbedBuilder()
        .setTitle('User has been unbanned')
        .setDescription(`The user with ID \`${userId}\` has been unbanned.`)
        .setColor(guildColours.success)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setFooter({ text: `Punishment ID: ${punishmentId}` })
        .setTimestamp();

      interaction.reply({ embeds: [unbannedEmbed] });
    } catch (error) {
      console.error(error);

      let errorMessage = 'An error occurred while trying to unban the user.';
      if (error instanceof DiscordAPIError) {
        switch (error.code) {
          case 50013:
            errorMessage = 'I do not have permission to unban this user. Please ensure I have the "Ban Members" permission.';
            break;
          case 10007:
            errorMessage = 'This user does not exist or is not banned.';
            break;
          case 50001:
            errorMessage = 'I do not have access to the requested resource. Please ensure I have the necessary permissions.';
            break;
          default:
            errorMessage = `An unknown error occurred: ${error.message}`;
            break;
        }
      }

      const errorEmbed = new EmbedBuilder()
        .setColor(guildColours.error) // Red color
        .setTitle('Error')
        .setDescription(errorMessage);

      interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
