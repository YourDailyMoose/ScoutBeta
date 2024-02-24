const { SlashCommandBuilder, MessageEmbed, ActionRowBuilder, EmbedBuilder, ButtonBuilder } = require('discord.js');
const { botColours } = require('../../index.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlist')
    .setDescription('Sends a list of banned users.'),
  permission: ['adminRoles', 'godRoles', 'banRoles'],
  async execute(interaction) {
    try {
      const fetchBans = interaction.guild.bans.fetch();
      const bannedMembers = await fetchBans;

      // Check if there are no banned members
      if (bannedMembers.size === 0) {
        const noBannedEmbed = new EmbedBuilder()
          .setColor(botColours.amber)
          .setTitle("Ban List")
          .setDescription('There are no banned users.')

        interaction.reply({ embeds: [noBannedEmbed] });
        return;
      }

      const embeds = [];
      const maxFields = 10; // Limit the number of banned members per embed
      let currentEmbed = new EmbedBuilder()
        .setColor(botColours.primary)
        .setTitle('Ban List');

      let fieldCount = 0;

      const fieldsArray = [];

      bannedMembers.forEach((banInfo) => {
        if (fieldCount >= maxFields) {
          currentEmbed.addFields(...fieldsArray);
          fieldsArray.length = 0; // Clear the array
          embeds.push(currentEmbed);
          currentEmbed = new EmbedBuilder()
            .setColor(botColours.primary)
            .setTitle('Ban List');
          fieldCount = 0;
        }

        const userInfo = `${banInfo.user.tag} (${banInfo.user.id})`;
        const reason = banInfo.reason || 'No reason provided';
        fieldsArray.push({ name: userInfo, value: `Reason: ${reason}` });

        fieldCount++;
      });

      // Add the last embed if it has any fields
      if (fieldCount > 0) {
        currentEmbed.addFields(...fieldsArray);
        embeds.push(currentEmbed);
      }

      const expiredButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('expired')
            .setLabel('Embed Expired')
            .setStyle('Secondary')
            .setDisabled(true)
        );
      const updateButtons = (currentPage, totalPages) => {
      return new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('Previous')
            .setStyle('Primary')
          .setEmoji('⬅️')
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
          .setEmoji('➡️')
            .setStyle('Primary')
            .setDisabled(currentPage === totalPages - 1)
        );
    };

    let currentPage = 0;
    const totalPages = embeds.length;

    const initialRow = updateButtons(currentPage, totalPages);

    const message = await interaction.reply({ embeds: [embeds[currentPage]], components: [initialRow], fetchReply: true });

    const collector = message.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (i) => {
      if (i.customId === 'previous' && currentPage !== 0) {
        currentPage--;
      } else if (i.customId === 'next' && currentPage < totalPages - 1) {
        currentPage++;
      }

      const newRow = updateButtons(currentPage, totalPages);
      await i.update({ embeds: [embeds[currentPage]], components: [newRow] });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [ expiredButton ] });  
    });

    } catch (error) {
      console.error(error);
      interaction.reply('An error occurred while fetching the ban list.');
    }
  },
};
