const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const botColours = require('../../botColours.json');

module.exports = {
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('listroles')
        .setDescription('List all the roles in the server.'),
    async execute(interaction) {
        const roles = interaction.guild.roles.cache
            .filter(role => role.name !== '@everyone') // Exclude the @everyone role
            .sort((a, b) => b.position - a.position) // Sort roles by position
            .map(role => `${role} - \`${role.id}\``) // Mention the role and include its ID
            .join('\n');
        const roleEmbed = new EmbedBuilder()
            .setTitle('Roles')
            .setDescription(roles)
            .setColor(botColours.primary);
            
        interaction.reply({ embeds: [roleEmbed] });
    },
};