const axios = require('axios');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const botColours = require('../../botColours.json');

module.exports = {
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a random joke'),
    async execute(interaction) {
        try {
            const response = await axios.get('https://official-joke-api.appspot.com/jokes/random');
            const joke = response.data;

            const jokeEmbed = new EmbedBuilder()
                .setTitle('Here\'s a joke for you!')
                .setDescription(`${joke.setup}\n\n||${joke.punchline}||`)
                .setColor(botColours.purple);

            await interaction.reply({ embeds: [jokeEmbed] });
        } catch (error) {
            console.error(error);
            await interaction.reply('There was an error when fetching a joke. Please try again!');
        }
    },
};