const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { v4: uuidv4 } = require("uuid");
const fs = require('fs');

module.exports = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('dog')
    .setDescription('Get a random dog picture!'),
  async execute(interaction) {

    await interaction.deferReply();
    const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)

    try {
      const response = await axios.get("https://dog.ceo/api/breeds/image/random");
      const data = response.data;

      const embed = new EmbedBuilder()
        .setTitle(`Random Dog Picture`)
        .setImage(data.message)
        .setColor(guildColours.primary)
        .setFooter({ text: `Fetched from dog.ceo` });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      const errorId = uuidv4();

      const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
      fs.appendFile('errorLog.txt', errorMessage, (err) => {
        if (err) throw err;
      });

      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('Failed to fetch a dog picture.')
        .setFooter({
          text: `If this error persists, please contact support with the followwing error ID: ${errorId}`,

        })
        .setColor(guildColours.error);

      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Support Server')
            .setStyle('Link')
            .setURL('https://scoutbot.me/support'),
        );


      await interaction.editReply({ embeds: [errorEmbed], components: [actionRow] });
    }
  },
};