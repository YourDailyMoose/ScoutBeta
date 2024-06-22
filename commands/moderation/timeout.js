const { SlashCommandBuilder, EmbedBuilder, DiscordAPIError, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const { getGuildSettings, logPunishment } = require('../../database.js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const ms = require('ms'); // Import the ms package

module.exports = {
  cooldown: 8,
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDMPermission(false)
    .setDescription('Select a member and timeout them for a specified duration.')
    .addUserOption(option => option.setName('target').setDescription('The member to timeout').setRequired(true))
    .addStringOption(option => option.setName('duration').setDescription('The duration of the timeout (e.g., 10m, 1h)').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the timeout').setRequired(false)),
  permission: ['muteRoles', 'adminRoles', 'godRoles'],
  async execute(interaction) {
    const targetMember = interaction.options.getMember('target');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guildSettings = await getGuildSettings(interaction.guild.id);

    if (!targetMember) {
      return interaction.reply({ content: 'The selected user is not in the server.', ephemeral: true });
    }

    if (guildSettings.moderationSettings && guildSettings.moderationSettings.requireReason && !reason) {
      return interaction.reply({ content: 'You must provide a reason.', ephemeral: true });
    }

    let timeoutDuration;
    try {
      timeoutDuration = parseDuration(duration); // Convert duration to milliseconds
      if (!timeoutDuration || isNaN(timeoutDuration)) {
        throw new Error('Invalid duration format');
      }
    } catch (error) {
      return interaction.reply({ content: 'Invalid duration format. Use something like "10m" for 10 minutes.', ephemeral: true });
    }

    try {
      await targetMember.timeout(timeoutDuration, reason);

      const punishmentId = uuidv4().replace(/-/g, '');

      try {
        await logPunishment(punishmentId, interaction.guild.id, targetMember.id, 'Timeout', reason, interaction.user.id, Date.now());

        const timeoutEmbed = new EmbedBuilder()
          .setTitle('User has been timed out')
          .setColor(botColours.green)
          .setDescription(`Successfully timed out ${targetMember} for \`${duration}\` for \`${reason}\`.`)
          .setFooter({ text: `Punishment ID: ${punishmentId}` })
          .setTimestamp();
        interaction.reply({ embeds: [timeoutEmbed] });
      } catch (error) {
        console.error(error);
        const errorId = uuidv4();
        const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
        fs.appendFile('errorLog.txt', errorMessage, (err) => {
          if (err) throw err;
        });

        const errorEmbed = new EmbedBuilder()
          .setTitle('Error')
          .setDescription(`There was an error logging your punishment. \n\nPlease contact support with this error ID: \`${errorId}\``)
          .setColor(guildColours.error);

        const supportServer = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Support Server')
              .setStyle(ButtonStyle.Link)
              .setURL('https://discord.gg/BwD7MgVMuq')
          );

        interaction.reply({ embeds: [errorEmbed], components: [supportServer], ephemeral: true });
      }
    } catch (error) {
      handleTimeoutError(error, interaction, targetMember);
    }
  }
};

function parseDuration(duration) {
  const parts = duration.split(' ');
  return parts.reduce((total, part) => total + ms(part), 0);
}

function handleTimeoutError(error, interaction, targetMember) {
  console.error(error);

  const errorId = uuidv4();
  const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
  fs.appendFile('errorLog.txt', errorMessage, (err) => {
    if (err) throw err;
  });

  let errorDescription = `There was an error timing out ${targetMember}.\n\nPlease contact support with the following error ID: \`${errorId}\``;

  if (error instanceof DiscordAPIError) {
    switch (error.code) {
      case 50013:
        errorDescription = `I do not have permission to timeout this user. Please ensure I have the \`Timeout Members\` permission and that my role is higher than the target user's role.`;
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