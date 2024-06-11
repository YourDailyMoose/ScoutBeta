const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const botColours = require('../../botColours.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll a dice and get a number between 1 and 6.'),
  async execute(interaction) {
    const outcome = Math.floor(Math.random() * 6) + 1;
    
    const embed = new EmbedBuilder()
      .setTitle('Dice Roll')
      .setDescription(`You rolled a **${outcome}**!`)
      .setColor(botColours.purple)

    await interaction.reply({ embeds: [embed] });
  },
};