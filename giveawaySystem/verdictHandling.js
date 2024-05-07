const { getGiveawayData, deleteGiveaway } = require('../database');
const botColours = require('../botColours.json');
const { EmbedBuilder } = require('discord.js');

const cron = require('node-cron');


async function scheduleGiveawayEnd(giveaway, client) {
    const endTime = new Date(giveaway.timestamp + giveaway.duration * 60 * 1000);
    const cronExpression = `${endTime.getMinutes()} ${endTime.getHours()} ${endTime.getDate()} ${endTime.getMonth() + 1} *`;
    const channel = await client.channels.fetch(giveaway.channelId.toString());

    cron.schedule(cronExpression, async () => {
        const giveawayData = await getGiveawayData(giveaway.messageId);

        if (!giveawayData || giveawayData.entries.length === 0) {
            const noEntriesEmbed = new EmbedBuilder()
                .setTitle('Giveaway Ended')
                .setDescription(`No one entered the giveaway for **${giveawayData.prize}**.`)
                .setColor(botColours.red)
                .setFooter({ text: 'Ended at' })
                .setTimestamp(new Date());

            channel.send({ embeds: [noEntriesEmbed] });

            deleteGiveaway(giveaway.messageId);
            return;
        }

        // Select a random winner
        const winnerIndex = Math.floor(Math.random() * giveawayData.entries.length);
        const winnerId = giveawayData.entries[winnerIndex];

        // Announce the winner
        const winner = await client.users.fetch(winnerId.toString());

        const winnerEmbed = new EmbedBuilder()
            .setTitle('Giveaway Ended')
            .setDescription(`Congratulations <@${winner.id}>, you have won **${giveawayData.prize}**!`)
            .setColor(botColours.green)
            .setFooter({ text: 'Ended at' })
            .setTimestamp(new Date());

        channel.send({ embeds: [winnerEmbed], content: `<@${winner.id}>` });

        deleteGiveaway(giveaway.messageId);
    });
}

module.exports = {
    scheduleGiveawayEnd
};