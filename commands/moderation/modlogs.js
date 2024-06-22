const { EmbedBuilder, SlashCommandBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { getModLogs } = require('../../database.js');
const botColours  = require('../../botColours.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('List punishments for a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to list punishments for').setRequired(true)),
    permission: ['warnRoles', 'kickRoles', 'muteRoles', 'banRoles', 'adminRoles', 'godRoles'],

  async execute(interaction) {

    const user = interaction.options.getUser('user');

    const guildId = interaction.guild.id;

    let modlogs = await getModLogs(user.id, guildId);

    if (modlogs.length === 0) {
      const noPunishmentsEmbed = new EmbedBuilder()
        .setColor(guildColours.warning)
        .setTitle('No Recorded Punishments')
        .setDescription(`No punishments were found for \`${user.tag}\`.`);

      await interaction.reply({ embeds: [noPunishmentsEmbed] });
      return;
    }

    // Sort modlogs by date in descending order
    modlogs.sort((a, b) => b.timestamp - a.timestamp);

    let currentPage = 0;
    const itemsPerPage = 8;
    const totalPages = Math.ceil(modlogs.length / itemsPerPage);

    const updateButtons = (currentPage, totalPages) => {
      return new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('Previous')
            .setEmoji('⬅️')
            .setStyle('Primary')
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setEmoji('➡️')
            .setStyle('Primary')
            .setDisabled(currentPage === totalPages - 1)
        );
    };

    const initialRow = updateButtons(currentPage, totalPages);

    const embed = new EmbedBuilder()
      .setTitle(`${user.tag}'s Modlogs`)
      .setColor(guildColours.primary);

      const updateEmbed = () => {
        const itemsToShow = modlogs.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
        embed.setDescription(itemsToShow.map((log, index) => {
          return `**${log.punishmentType}**\nID: ${log._id}\nModerator: <@${log.moderatorId}>\nReason: ${log.reason}\nDate: ${new Date(log.timestamp).toUTCString()}`;
        }).join('\n\n'));
      
        embed.setFooter({ text: `Page ${currentPage + 1} of ${totalPages} | Found ${modlogs.length} log(s)`});
      };

    updateEmbed();

    const message = await interaction.reply({ embeds: [embed], components: [initialRow], fetchReply: true });

    const collector = message.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (i) => {
      if (i.customId === 'previous' && currentPage !== 0) {
        currentPage--;
      } else if (i.customId === 'next' && currentPage < totalPages - 1) {
        currentPage++;
      }

      const newRow = updateButtons(currentPage, totalPages);
      updateEmbed();
      await i.update({ embeds: [embed], components: [newRow] });
    });

    collector.on('end', () => {
      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('Previous')
            .setEmoji('⬅️')
            .setStyle('Primary')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setEmoji('➡️')
            .setStyle('Primary')
            .setDisabled(true)
        );
    
      message.edit({ components: [disabledRow] });
    });
  },
};