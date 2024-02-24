const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guessthenumber')
        .setDescription('Guess the number game'),
    async execute(interaction) {
        let answer = Math.floor(Math.random() * 100) + 1; // Random number between 1 and 100

        await interaction.reply('I have a number between 1 and 100. Can you guess it? You have 20 seconds and 15 guesses!');

        // Filter function to only collect messages from the user who initiated the command, if the author is not a bot, and if the message content is a number
        const collectorFilter = m => m.author.id === interaction.user.id && !m.author.bot && !isNaN(m.content);
        const collector = interaction.channel.createMessageCollector({ filter: collectorFilter, time: 20000, max: 15 });

        collector.on('collect', m => {
            let guess = parseInt(m.content);
            if (guess === answer) {
                collector.stop();
                m.reply(`Congratulations ${m.author}! You guessed the number, It was ${answer}`);
            } else if (guess < answer) {
                m.reply(`\`${guess}\` is too low!`);
            } else if (guess > answer) {
                m.reply(`\`${guess}\` is too high!`);
            }
        });

        collector.on('end', collected => {
            if (!collected.some(m => parseInt(m.content) === answer)) {
                interaction.followUp(`Sorry, you didn't guess the number. The number was ${answer}.`);
            }
        });
    },
};