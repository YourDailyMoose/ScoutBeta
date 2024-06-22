const { SlashCommandBuilder, EmbedBuilder, DiscordAPIError, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildSettings, logPunishment } = require('../../database.js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDMPermission(false)
    .setDescription('Select a member and kick them from the server.')
    .addUserOption(option => option.setName('target').setDescription('The member to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for kicking the member').setRequired(false)),
  permission: ['kickRoles', 'adminRoles', 'godRoles'],
  async execute(interaction) {

    const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
    const reason = interaction.options.getString('reason');
    const guildSettings = await getGuildSettings(interaction.guild.id);
    const targetMember = interaction.options.getMember('target');

    let finalReason;
    if (!reason) {
      finalReason = 'No reason provided';
    } else {
      finalReason = reason;
    }

    if (guildSettings && guildSettings.moderationSettings && guildSettings.moderationSettings.requireReason && !reason) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('You must provide a reason.')
        .setColor(guildColours.error);

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    if (!targetMember) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('The selected user is not in the server.')
        .setColor(guildColours.error);

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    let targetHighestRole = null;
    if (targetMember.roles && targetMember.roles.highest) {
      targetHighestRole = targetMember.roles.highest;
    }

    if (guildSettings.moderationSettings && guildSettings.moderationSettings.permissionHierarchy && targetHighestRole) {
      const authorHighestRole = interaction.member.roles.highest;

      if (authorHighestRole.position <= targetHighestRole.position) {
        const errorEmbed = new EmbedBuilder()
          .setTitle('Error')
          .setDescription('You cannot kick users that are above your role.')
          .setColor(guildColours.error);

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }

    try {
      const punishmentId = uuidv4().replace(/-/g, '');

      try {
        await logPunishment(punishmentId, interaction.guild.id, targetMember.id, 'Kick', finalReason, interaction.user.id, Date.now());

        await targetMember.kick(finalReason);

        const kickedEmbed = new EmbedBuilder()
          .setTitle('User has been kicked')
          .setColor(botColours.green)
          .setDescription(`Successfully kicked ${targetMember} for \`${finalReason}\`.`)
          .setFooter({ text: `Punishment ID: ${punishmentId}` })
          .setTimestamp();
        interaction.reply({ embeds: [kickedEmbed] });
      } catch (error) {
        handleKickError(error, interaction, targetMember);
      }
    } catch (error) {
      handleKickError(error, interaction, targetMember);
    }
  }
};

function handleKickError(error, interaction, targetMember) {
  console.error(error);

  const errorId = uuidv4();
  const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
  fs.appendFile('errorLog.txt', errorMessage, (err) => {
    if (err) throw err;
  });

  let errorDescription = `There was an error kicking ${targetMember}.\n\nPlease contact support with the following error ID: \`${errorId}\``;

  if (error instanceof DiscordAPIError) {
    switch (error.code) {
      case 50013:
        errorDescription = `I do not have permission to kick this user. Please ensure I have the \`Kick Members\` permission and that my role is higher than the target user's role.`;
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