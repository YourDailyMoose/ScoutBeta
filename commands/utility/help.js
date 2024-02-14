const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const botColours = require('../../botColours.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays information about the bot.'),
  async execute(interaction) {
    const introductionMessage = `Hello! I'm Scout Beta, a moderation, utility and fun bot made by YourDailyMoose. I'm currently in development, so expect bugs and missing features. If you find any bugs, please report them in our Support Server.`;

    // Fetch all commands
    const commands = await interaction.client.application.commands.fetch();

    const fields = commands.map(command => ({ name: command.name, value: command.description }));

    const helpmenu = new EmbedBuilder()
      .setTitle("**Help Menu**")
      .setColor(botColours.primary)
      .setDescription(introductionMessage)
      .addFields(fields)
      .setFooter({ text: "Scout Beta - Created by YourDailyMoose | Contributors: Limitless4315 & 1spinnewiel" });

    const supportServer = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Support Server')
          .setStyle('Link')
          .setURL('https://discord.gg/BwD7MgVMuq')
      );

    await interaction.reply({ embeds: [helpmenu], components: [supportServer] });
  },
};