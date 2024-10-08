const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildBotColours, removeUserXP, getUserXP } = require('../../database');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('removexp')
        .setDescription('Remove XP from a user')
        .addUserOption(option =>
        option.setName('user')
            .setDescription('The user you want to add XP to')
            .setRequired(true))
        .addIntegerOption(option =>
        option.setName('xp')
            .setDescription('The amount of XP to remove')
            .setRequired(true)),
    async execute(interaction) {
        const guildColours = await getGuildBotColours(interaction.guild.id);
        const user = interaction.options.getUser('user');
        const xp = interaction.options.getInteger('xp');
        const userXP = await getUserXP(interaction.guild.id, user.id);
        const removeXP = removeUserXP(interaction.guild.id, user.id, xp);
        if (!removeXP) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                    .setColor(guildColours.error)
                    .setTitle(`Error`)
                    .setDescription(`User has no XP, user does not have enough XP to remove, or an error occurred. Please try again or contact support.`)
                    .setTimestamp()
                ]
            });
        }
        interaction.reply({
        embeds: [
            new EmbedBuilder()
            .setColor(guildColours.success)
            .setTitle(`Success`)
            .setDescription(`Removed ${xp} XP from ${user}! They now have ${userXP - xp} XP.`)
            .setTimestamp()
        ]
        });
    }
    };