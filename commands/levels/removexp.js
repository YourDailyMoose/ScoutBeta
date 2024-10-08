const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildBotColours, removeUserXP } = require('../../database');
const { addUserXP, getUserXP } = require('../../database');

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
        console.log('Command executed: removexp');
        
        const guildColours = await getGuildBotColours(interaction.guild.id);
        console.log('Guild Colours:', guildColours);
        
        const user = interaction.options.getUser('user');
        console.log('Target User:', user);
        
        const xp = interaction.options.getInteger('xp');
        console.log('XP to remove:', xp);
        
        const userXP = await getUserXP(interaction.guild.id, user.id);
        console.log('Current User XP:', userXP);
        
        const removeXP = await removeUserXP(interaction.guild.id, user.id, xp);
        console.log('Remove XP Result:', removeXP);
        
        if (!removeXP) {
            console.log('Failed to remove XP');
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
        
        console.log('Successfully removed XP');
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