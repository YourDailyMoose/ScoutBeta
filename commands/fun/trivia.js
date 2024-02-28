const axios = require('axios');
const he = require('he');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    cooldown: 20,
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Do some trivia on various topics!')
        .addStringOption(option =>
            option.setName('difficulty')
                .setDescription('Difficulty of the trivia question')
                .setRequired(true)
                .addChoices(
                    { name: 'Easy', value: 'easy' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Hard', value: 'hard' }
                ))
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Category of the trivia question')
                .setRequired(true)
                .addChoices(
                    { name: 'Film', value: '11' },
                    { name: 'Music', value: '12' },
                    { name: 'Video Games', value: '15' },
                    { name: 'Geography', value: '22' },
                    { name: 'Sports', value: '21' },
                    { name: 'History', value: '23' },
                    { name: 'Animals', value: '27' },
                    { name: 'Computers', value: '18' }
                ))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of the trivia question')
                .setRequired(true)
                .addChoices(
                    { name: 'Multiple Choice', value: 'multiple' },
                    { name: 'True/False', value: 'boolean' }
                )),
    async execute(interaction) {
        const difficulty = interaction.options.getString('difficulty');
        const category = interaction.options.getString('category');
        const type = interaction.options.getString('type');

        interaction.deferReply();

        try {
            const response = await axios.get(`https://opentdb.com/api.php?amount=1&type=${type}&difficulty=${difficulty}&category=${category}`);
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

            await interaction.editReply({
                content: `**${he.decode(question.question)}**\nSelect the correct answer from the buttons below.`,
                components: [row]
            });

            const filter = i => i.customId.startsWith('trivia') && i.user.id === interaction.user.id;

            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async i => {
                const correctIndex = shuffledAnswers.indexOf(he.decode(question.correct_answer));
                const selectedIndex = parseInt(i.customId.split('_')[1]);
            
                buttons.forEach((button, index) => {
                    if (index === correctIndex) {
                        button.setStyle('Success');
                        button.setDisabled(true);
                    } else if (index === selectedIndex) {
                        button.setStyle('Danger');
                        button.setDisabled(true);
                    } else {
                        button.setDisabled(true);
                    }
                });
            
                if (selectedIndex === correctIndex) {
                    await i.update({ content: 'Congratulations! You selected the correct answer.', components: [row] });
                } else {
                    await i.update({ content: `Sorry, that's incorrect. The correct answer was: ${he.decode(question.correct_answer)}`, components: [row] });
                }
                collector.stop();
            });

            collector.on('end', collected => {
                if (collected.size === 0) interaction.editReply({ content: `Sorry, time's up! The correct answer was: ${he.decode(question.correct_answer)}`, components: [] });
            });
        }
        catch (error) {
            if (error.response && error.response.status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                if (retryAfter) {
                    console.log(`Rate limit exceeded, retrying after ${retryAfter} seconds.`);
                    setTimeout(() => execute(interaction), retryAfter * 1000);
                }
            } else {
                console.error(error);
                interaction.editReply('Failed to fetch a trivia question. Please try again later.');
            }
        }
    }
};