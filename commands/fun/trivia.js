const axios = require('axios');
const he = require('he');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Trivia game'),
    async execute(interaction) {
        try {
            const response = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
            const question = response.data.results[0];
            const answers = [...question.incorrect_answers, question.correct_answer].map(answer => he.decode(answer));
            const shuffledAnswers = answers.sort(() => Math.random() - 0.5);

            const buttons = shuffledAnswers.map((answer, index) => {
                return new ButtonBuilder()
                    .setCustomId(`trivia_${index}`)
                    .setLabel(answer)
                    .setStyle('Primary');
            });

            const row = new ActionRowBuilder()
                .addComponents(buttons);

            await interaction.reply({
                content: `**${he.decode(question.question)}**\nSelect the correct answer from the buttons below.`,
                components: [row]
            });

            const filter = i => i.customId.startsWith('trivia') && i.user.id === interaction.user.id;

            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async i => {
                if (i.customId === `trivia_${shuffledAnswers.indexOf(he.decode(question.correct_answer))}`) {
                    await i.update({ content: 'Congratulations! You selected the correct answer.', components: [] });
                } else {
                    await i.update({ content: `Sorry, that's incorrect. The correct answer was: ${he.decode(question.correct_answer)}`, components: [] });
                }
                collector.stop();
            });

            collector.on('end', collected => {
                if (collected.size === 0) interaction.editReply({ content: `Sorry, time's up! The correct answer was: ${he.decode(question.correct_answer)}`, components: [] });
            });
        } catch (error) {
            console.error(error);
            interaction.reply('Failed to fetch a trivia question. Please try again later.');
        }
    },
};