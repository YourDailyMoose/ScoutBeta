const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const botColours = require('../../botColours.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin and get heads or tails.'),
  async execute(interaction) {
    const outcome = Math.random() < 0.5 ? 'Heads' : 'Tails';
    
    const embed = new EmbedBuilder()
      .setTitle('Coin Flip')
      .setDescription(`The coin landed on: **${outcome}**!`)
      .setColor(botColours.purple)

    await interaction.reply({ embeds: [embed] });
  },
};
