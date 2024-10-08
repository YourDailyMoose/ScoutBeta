const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildBotColours } = require('../../database');
const { addUserXP, getUserXP } = require('../../database');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user')
        .addUserOption(option =>
        option.setName('user')
            .setDescription('The user you want to add XP to')
            .setRequired(true))
        .addIntegerOption(option =>
        option.setName('xp')
            .setDescription('The amount of XP to add')
            .setRequired(true)),
    async execute(interaction) {
        const guildColours = await getGuildBotColours(interaction.guild.id);
        const user = interaction.options.getUser('user');
        const xp = interaction.options.getInteger('xp');
        const userXP = await getUserXP(interaction.guild.id, user.id);
        const addXP = addUserXP(interaction.guild.id, user.id, xp);
        if (!addXP) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                    .setColor(guildColours.error)
                    .setTitle(`Error`)
                    .setDescription(`User has no XP or an error occurred.`)
                    .setTimestamp()
                ]
            });
        }
        interaction.reply({
        embeds: [
            new EmbedBuilder()
            .setColor(guildColours.success)
            .setTitle(`Success`)
            .setDescription(`Added ${xp} XP to ${user}! They now have ${userXP + xp} XP.`)
            .setTimestamp()
        ]
        });
    }
    };