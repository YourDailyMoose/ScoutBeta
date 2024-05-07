const { SlashCommandBuilder, EmbedBuilder, DiscordAPIError, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const botColours = require('../../botColours.json');
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
        .setColor(botColours.red);

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }


    if (!targetMember) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('The selected user is not in the server.')
        .setColor(botColours.red);

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
          .setColor(botColours.red);

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
          .setDescription(`Successfully kicked ${targetMember} for \`${reason}.\``)
          .setFooter({ text: `Punishment ID: ${punishmentId}` })
          .setTimestamp();
        interaction.reply({ embeds: [kickedEmbed] });
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
          .setColor(botColours.red);

        const supportServer = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Support Server')
              .setStyle('Link')
              .setURL('https://discord.gg/BwD7MgVMuq')
          );

        interaction.reply({ embeds: [errorEmbed], components: [supportServer], ephemeral: true });
      }
    } catch (error) {
      console.error(error);

      const errorId = uuidv4();
      const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
      console.error(`Error ID: ${errorId}`);
      fs.appendFile('errorLog.txt', errorMessage, (err) => {
        if (err) throw err;
      });

      let errorDescription = `There was an error kicking ${targetMember}.\n\nPlease contact support with the following error ID: \`${errorId}\``;

      // Check if the error is a DiscordAPIError with code 50013
      if (error instanceof DiscordAPIError && error.code === 50013) {
        errorDescription = `Unable to kick \`${targetMember}\`. \n\nPlease check that I have the \`Kick Members\` permission and that I have a role that is higher than the target user.`;
      }

      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription(errorDescription)
        .setColor(botColours.red)
        .setTimestamp()
        .setFooter({ text: `Please contact support with the following error ID if the issue persists: ${errorId}x` });

      const supportServer = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Support Server')
            .setStyle('Link')
            .setURL('https://discord.gg/BwD7MgVMuq')

        );

      interaction.reply({ embeds: [errorEmbed], components: [supportServer], ephemeral: true });
    }
  }
};
