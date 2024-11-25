const { SlashCommandBuilder, EmbedBuilder, DiscordAPIError, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildSettings, logPunishment } = require('../../database.js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDMPermission(false)
    .setDescription('Ban a user from the server.')
    .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(false))
    .addStringOption(option => option.setName('delete_duration').setDescription('Duration of messages to delete (e.g., 1d, 7d)').setRequired(false)),
  permission: ['banRoles', 'adminRoles', 'godRoles'],
  async execute(interaction) {
    const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDuration = interaction.options.getString('delete_duration') || '0d';

    const guildId = await interaction.guild.id;
    console.log(`Guild ID = ${guildId}`);
    let guildSettings;
    try {
      guildSettings = await getGuildSettings(guildId); 
    } catch (err) {
      return handleBanError(err, interaction, user, 'Error fetching guild settings');
    }

    if (guildSettings.modules.moderation.settings && guildSettings.modules.moderation.settings.requireReason && !reason) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('You must provide a reason.')
        .setColor(guildColours.error);

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Convert delete duration to seconds
    let deleteSeconds;
    try {
      const deleteDurationMs = ms(deleteDuration);
      deleteSeconds = Math.floor(deleteDurationMs / 1000);
      if (isNaN(deleteSeconds) || deleteSeconds < 0) {
        throw new Error('Invalid duration format');
      }
      if (deleteSeconds > 7 * 24 * 60 * 60) { // Discord only allows up to 7 days of messages to be deleted
        deleteSeconds = 7 * 24 * 60 * 60;
      }
    } catch (err) {
      return interaction.reply({ content: 'Invalid delete duration format. Use something like "1d" for one day.', ephemeral: true });
    }

    try {
      const punishmentId = uuidv4().replace(/-/g, '');
      await interaction.guild.bans.create(user.id, { reason, deleteMessageSeconds: deleteSeconds });
      await logPunishment(punishmentId, guildId, user.id, 'Ban', reason, interaction.user.id, Date.now());

      const bannedEmbed = new EmbedBuilder()
        .setTitle('User has been banned')
        .setColor(guildColours.success)
        .setDescription(`Successfully banned ${user.tag} for \`${reason}\`.`)
        .setFooter({ text: `Punishment ID: ${punishmentId}` })
        .setTimestamp();
      await interaction.reply({ embeds: [bannedEmbed] });
    } catch (err) {
      await handleBanError(err, interaction, user, 'Error creating ban or logging punishment');
    }
  }
};

async function handleBanError(err, interaction, user, context) {
  console.error(`Context: ${context}`, err);

  const errorId = uuidv4();
  const errorMessage = `Error ID: ${errorId}, Context: ${context}, Error Details: ${err.stack}\n`;
  fs.appendFile('errorLog.txt', errorMessage, (err) => {
    if (err) throw err;
  });

  let errorDescription = `There was an error banning ${user.tag}.\n\nPlease contact support with the following error ID: \`${errorId}\``;

  if (err instanceof DiscordAPIError) {
    switch (err.code) {
      case 50013:
        errorDescription = `I do not have permission to ban this user. Please ensure I have the \`Ban Members\` permission and that my role is higher than the target user's role.`;
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
        errorDescription = `An unknown error occurred: ${err.message}`;
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

  await interaction.reply({ embeds: [errorEmbed], components: [supportServer], ephemeral: true });
}
