const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildSettings, logPunishment } = require('../../database.js');
const botColours = require('../../botColours.json');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the warning').setRequired(false)),
  permission: ['warnRoles', 'adminRoles', 'godRoles'],
  async execute(interaction) {

    const targetMember = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');


    let finalReason;
    if (!reason) {
      finalReason = 'No reason provided';
    } else {
      finalReason = reason;
    }


    const guildSettings = await getGuildSettings(interaction.guild.id);

    if (guildSettings && guildSettings.moderationSettings && guildSettings.moderationSettings.requireReason && !reason) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('You must provide a reason.')
        .setColor(botColours.red);

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    let targetHighestRole = null;
    if (targetMember && targetMember.roles && targetMember.roles.highest) {
      targetHighestRole = targetMember.roles.highest;
    }

    if (guildSettings.moderationSettings && guildSettings.moderationSettings.permissionHierarchy && targetHighestRole) {
      const authorHighestRole = interaction.member.roles.highest;

      if (authorHighestRole.position <= targetHighestRole.position) {
        const errorEmbed = new EmbedBuilder()
          .setTitle('Error')
          .setDescription('You cannot warn users that are above your role.')
          .setColor(botColours.red);

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
    try {
      const punishmentId = uuidv4().replace(/-/g, '');
      try {
        await logPunishment(punishmentId, interaction.guild.id, targetMember.id, "Warning", finalReason, interaction.user.id, Date.now());

        const warnedEmbed = new EmbedBuilder()
          .setColor(botColours.green)
          .setTitle('User Warned')
          .setDescription(`Successfully warned ${targetMember} for \`${finalReason}\`.`)
          .setTimestamp()
          .setFooter({ text: `Punishment ID: ${punishmentId}` })

        interaction.reply({ embeds: [warnedEmbed] });
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

      let errorDescription = `There was an error warning ${targetMember}.`;


      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription(errorDescription)
        .setColor(botColours.red)
        .setTimestamp()
        .setFooter({ text: `Please contact support with the following error ID if the issue persists: ${errorId}` });

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

