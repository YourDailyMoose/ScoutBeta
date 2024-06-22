const { SlashCommandBuilder, EmbedBuilder, DiscordAPIError, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const { getGuildSettings, logPunishment } = require('../../database.js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDMPermission(false)
    .setDescription('Remove the timeout from a member.')
    .addUserOption(option => option.setName('target').setDescription('The member to untimeout').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for removing the timeout').setRequired(false)),
  permission: ['muteRoles', 'adminRoles', 'godRoles'],
  async execute(interaction) {
    const targetMember = interaction.options.getMember('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guildSettings = await getGuildSettings(interaction.guild.id);

    if (!targetMember) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('The selected user is not in the server.').setColor(guildColours.error)], ephemeral: true });
    }

    if (guildSettings.moderationSettings && guildSettings.moderationSettings.requireReason && !reason) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('You must provide a reason.').setColor(guildColours.error)], ephemeral: true });
    }

    let targetHighestRole = targetMember.roles.highest;
    let authorHighestRole = interaction.member.roles.highest;

    if (guildSettings.moderationSettings && guildSettings.moderationSettings.permissionHierarchy && authorHighestRole.position <= targetHighestRole.position) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('You cannot untimeout users that are above your role.').setColor(guildColours.error)], ephemeral: true });
    }

    try {
      const punishmentId = uuidv4().replace(/-/g, '');

      try {
        await logPunishment(punishmentId, interaction.guild.id, targetMember.id, 'Untimeout', reason, interaction.user.id, Date.now());

        await targetMember.timeout(null); // Removing the timeout

        const untimeoutEmbed = new EmbedBuilder()
          .setTitle('User\'s timeout has been lifted.')
          .setColor(botColours.green)
          .setDescription(`Successfully removed timeout from ${targetMember} for \`${reason}\`.`)
          .setFooter({ text: `Punishment ID: ${punishmentId}` })
          .setTimestamp();
        interaction.reply({ embeds: [untimeoutEmbed] });
      } catch (error) {
        handleUntimeoutError(error, interaction, targetMember);
      }
    } catch (error) {
      handleUntimeoutError(error, interaction, targetMember);
    }
  }
};

function handleUntimeoutError(error, interaction, targetMember) {
  console.error(error);

  const errorId = uuidv4();
  const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
  fs.appendFile('errorLog.txt', errorMessage, (err) => {
    if (err) throw err;
  });

  let errorDescription = `There was an error removing the timeout from ${targetMember}.\n\nPlease contact support with the following error ID: \`${errorId}\``;

  if (error instanceof DiscordAPIError) {
    switch (error.code) {
      case 50013:
        errorDescription = `I do not have permission to remove the timeout from this user. Please ensure I have the \`Timeout Members\` permission and that my role is higher than the target user's role.`;
        break;
      case 10007:
        errorDescription = 'This user does not exist or is not a member of the guild.';
        break;
      case 50001:
        errorDescription = 'I do not have access to the requested resource. Please ensure I have the necessary permissions.';
        break;
      case 50035:
        errorDescription = 'Invalid Form Body. This might be due to an internal error or incorrect parameters.';
        break;
      default:
        errorDescription = `An unknown error occurred: ${error.message}`;
        break;
    }
  }

  const errorEmbed = new EmbedBuilder()
    .setTitle('Error')
    .setDescription(errorDescription)
    .setColor(guildColours.error)
    .setTimestamp()
    .setFooter({ text: `Please contact support with the following error ID if the issue persists: ${errorId}` });

  const supportServer = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Support Server')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/BwD7MgVMuq')
    );

  interaction.reply({ embeds: [errorEmbed], components: [supportServer], ephemeral: true });
}