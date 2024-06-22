const { SlashCommandBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banlist')
        .setDescription('Sends a list of banned users.'),
    permission: ['adminRoles', 'godRoles', 'banRoles'],
    async execute(interaction) {
        const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
        try {
            const fetchBans = interaction.guild.bans.fetch();
            const bannedMembers = await fetchBans;

            // Check if there are no banned members
            if (bannedMembers.size === 0) {
                const noBannedEmbed = new EmbedBuilder()
                    .setColor(guildColours.warning)
                    .setTitle("Ban List")
                    .setDescription('There are no banned users.')

                interaction.reply({ embeds: [noBannedEmbed] });
                return;
            }

            const itemsPerPage = 10;
            let page = 0;

            const embeds = [];
            const bannedMembersArray = Array.from(bannedMembers.values());

            for (let i = 0; i < bannedMembersArray.length; i += itemsPerPage) {
                const fieldsArray = bannedMembersArray.slice(i, i + itemsPerPage).map((banInfo, index) => {
                    const userInfo = `${banInfo.user.tag} (${banInfo.user.id})`;
                    const reason = banInfo.reason || 'No reason provided';
                    return { name: userInfo, value: `Reason: ${reason}` };
                });

                const banListEmbed = new EmbedBuilder()
                    .setColor(guildColours.primary)
                    .setTitle(`Banned Users`)
                    .addFields(fieldsArray)
                    .setTimestamp()
                    .setFooter({ text: `Page ${i / itemsPerPage + 1}/${Math.ceil(bannedMembers.size / itemsPerPage)}` });

                embeds.push(banListEmbed);
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('Previous')
                        .setStyle('Primary')
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle('Primary')
                        .setDisabled(page === embeds.length - 1),
                );

            await interaction.reply({ embeds: [embeds[page]], components: [row] });

            const message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'previous') {
                    if (page > 0) page--;
                } else if (interaction.customId === 'next') {
                    if (page < embeds.length - 1) page++;
                }

                row.components[0].setDisabled(page === 0);
                row.components[1].setDisabled(page === embeds.length - 1);

                await interaction.update({ embeds: [embeds[page]], components: [row] });
            });

            collector.on('end', async () => {
                row.components.forEach(button => button.setDisabled(true));
                await message.edit({ components: [row] });
            });

        } catch (error) {
            console.error(error);
            interaction.reply('An error occurred while fetching the ban list.');
        }
    },
};