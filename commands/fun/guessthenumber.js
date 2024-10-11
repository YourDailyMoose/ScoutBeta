const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('guessthenumber')
        .setDescription('Guess the number game')
        .addIntegerOption(option =>
            option.setName('max')
                .setDescription('The maximum number for the game')
                .setRequired(false)
                .setMinValue(100)
                .setMaxValue(10000)),
    async execute(interaction) {
        const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
        const max = interaction.options.getInteger('max') || 100;
        let answer = Math.floor(Math.random() * max) + 1; // Random number between 1 and max
        console.log(answer);

        await interaction.reply(`I have a number between 1 and ${max}. Can you guess it? You have 30 seconds!`);

        // Filter function to only collect messages from the user who initiated the command, if the author is not a bot, and if the message content is a number
        const collectorFilter = m => !isNaN(m.content);
        const collector = interaction.channel.createMessageCollector({ filter: collectorFilter, time: 30000 });

        collector.on('collect', m => {
            let guess = parseInt(m.content);
            if (guess === answer) {
                collector.stop();
                m.reply(`Congratulations ${m.author}! You guessed the number, It was ${answer}`);
            } else if (guess < answer) {
                if (answer - guess <= 20) {
                    m.reply(`You are getting close! But \`${guess}\` is too low!`);
                } else {
                    m.reply(`\`${guess}\` is too low!`);
                }
            } else if (guess > answer) {
                if (guess - answer <= 20) {
                    m.reply(`You are getting close! But \`${guess}\` is too high!`);
                } else {
                    m.reply(`\`${guess}\` is too high!`);
                }
            }
        });

        collector.on('end', collected => {
            if (!collected.some(m => parseInt(m.content) === answer)) {
                interaction.followUp(`Sorry, you didn't guess the number. The number was ${answer}.`);
            }
        });
    },
};