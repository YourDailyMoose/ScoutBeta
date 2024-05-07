const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const botColours = require('../../botColours.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays information about the bot.'),
  async execute(interaction) {
    const introductionMessage = `Hello! I'm Scout, a moderation, utility and fun bot made by YourDailyMoose. I'm currently in development, so expect bugs and missing features. If you find any bugs, please report them in our Support Server.`;

    const helpmenu = new EmbedBuilder()
      .setTitle("**Help Menu**")
      .setColor(botColours.primary)
      .setDescription(introductionMessage)
      .setFooter({ text: "Scout - Created by YourDailyMoose | Contributors: Limitless4315 & 1spinnewiel" })

      const supportServer = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Support Server')
            .setStyle('Link')
            .setURL('https://discord.gg/BwD7MgVMuq')
        );
    interaction.reply({ embeds: [helpmenu], components: [supportServer]});
  },
};
