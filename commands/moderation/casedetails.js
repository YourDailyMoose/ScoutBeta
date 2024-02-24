const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const botColours = require('../../botColours.json');
const { getPunishment, updateReason } = require('../../database.js'); // Ensure updateReason is properly imported or defined

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casedetails')
        .setDescription('Get details about a case.')
        .addStringOption(option => option.setName('punishmentid').setDescription('The ID of the punishment to get details for').setRequired(true)),
    permission: ['warnRoles', 'kickRoles', 'muteRoles', 'banRoles', 'adminRoles', 'godRoles'],
    async execute(interaction) {
        const punishmentId = interaction.options.getString('punishmentid');
        const punishment = await getPunishment(punishmentId);

        if (!punishment) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription('Invalid Punishment ID.')
                .setColor(botColours.red);
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    
        const caseDetailsEmbed = new EmbedBuilder()
            .setTitle(`Case Details for \`${punishment._id}\``)
            .setDescription(`**User:** <@${punishment.userId}>\n**Type:** ${punishment.punishmentType}\n**Reason:** ${punishment.reason}\n**Moderator:** <@${punishment.moderatorId}>\n**Timestamp:** ${new Date(punishment.timestamp).toUTCString()}`)
            .setColor(botColours.primary);
    
        interaction.reply({ embeds: [caseDetailsEmbed] });
    }
};