async function handleExperienceGain(message) {
  const xpGain = Math.floor(Math.random() * (20 - 5 + 1)) + 5; // Random XP between 5 and 20
  const currentXP = await getUserXP(message.guild.id, message.author.id);
  const newXP = currentXP + xpGain;

  // Leveling logic here, for example:
  const level = Math.floor(newXP / 100); // Replace with your leveling formula
  if (level > Math.floor(currentXP / 100)) {
    message.reply(`Congratulations! You leveled up to ${level}! 🎉`);
  }

  // Update the user's XP in the database
  await updateUserXP(message.guild.id, message.author.id, xpGain);
}