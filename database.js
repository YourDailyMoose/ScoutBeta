const { MongoClient, ServerApiVersion, ObjectId, Long } = require('mongodb');
const { DateTime } = require('luxon');
const { v4: uuidv4 } = require('uuid');


let db;

async function connectDatabase(uri) {
  try {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    await client.connect();
    db = client.db('botData');
  } catch (error) {
    console.error('Failed to connect to the database', error);
    throw error; // re-throw the error if you want to handle it further up the call stack
  }
}


function getDB() {
  return db;
}

async function onInvite(guildId) {
  // Assume 'db' is your database connection. Ensure it's properly initialized.
  const existingGuildData = await db.collection('botSettings').findOne({ _id: guildId });

  // If no document was found for the guild, insert new default settings
  if (!existingGuildData) {
    const guildData = {

      "_id": Long.fromString(guildId),
      "moderationSettings": {
        "requireReason": false,
        "permissionHierarchy": true
      },
      "rolePermissions": {
        "godRoles": [],
        "adminRoles": [],
        "banRoles": [],
        "kickRoles": [],
        "muteRoles": [],
        "warnRoles": []
      },
      "modules": {
        "welcomeMessages": {
          "enabled": false,
          "message": {
            "embed": {
              "enabled": false,
              "title": "Welcome to the server!",
              "description": "Thanks for joining the server, <user>!",
              "thumbnail": {
                "enabled": false,
                "profilePicture": true,
                "serverIcon": false,
                "url": ""
              },
              "color": 11566958
            },
            "text": {
              "enabled": true,
              "content": "Welcome to the server <user>!"
            }
          }
        },
        "leaveMessages": {
          "enabled": false,
          "message": {
            "embed": {
              "enabled": false,
              "title": "Goodbye!",
              "description": "Goodbye, <user>!",
              "thumbnail": {
                "enabled": false,
                "profilePicture": true,
                "serverIcon": false,
                "url": ""
              },
              "color": 11566958
            },
            "text": {
              "enabled": true,
              "content": "Goodbye <user>!"
            }
          }
        },
        "moderation": true,
        "fun": true,
        "utility": true,
        "levels": {
          "enabled": false,
          "levelRoles": [],
          "levelMessages": []
        },
        "logging": {
          "enabled": true,
          "loggingChannels": {
            "moderation": null,
            "joinLeave": null,
            "message": null,
            "voice": null,
            "memberChanges": null,
            "serverChanges": null
          }
        }
      },
      "disabledCommands": []
    }

    try {
      await db.collection('botSettings').insertOne(guildData);
      console.log(`Added guild ${guildId} to the database.`);
      return false; // Return false because no existing document was found
    } catch (error) {
      console.error(`Error adding guild ${guildId} to the database:`, error);
      throw error; // Throw the error to be handled by the caller
    }
  }
}


async function wipeGuildSettings(guildId) {
  try {
    await db.collection('botSettings').deleteOne({ _id: guildId });
    return (true)
  } catch (error) {
    console.error(`Error deleting guild ${guildId} from the database:`, error);
    return (false)
  }
}



async function getGuildSettings(guildId) {
  const longGuildId = Long.fromString(guildId);
  return await db.collection('botSettings').findOne({ _id: longGuildId });
}

async function logPunishment(punishmentId, guildId, userId, punishmentType, reason, moderatorId, timestamp) {

  const punishmentData = {
    _id: punishmentId,
    guildId: Long.fromString(guildId),
    userId: Long.fromString(userId),
    punishmentType: punishmentType,
    reason: reason,
    moderatorId: Long.fromString(moderatorId),
    timestamp: timestamp
  }
  try {
    await db.collection('punishmentData').insertOne(punishmentData);
    console.log(`Added punishment ${punishmentId} to the database.`);
    return false; // Return false because no existing document was found
  } catch (error) {
    console.error(`Error adding punishment ${punishmentId} to the database:`, error);
    throw error; // Throw the error to be handled by the caller
  }
}

async function getModLogs(userId, guildId) {
  const longGuildId = Long.fromString(guildId);
  const longUserId = Long.fromString(userId);
  return await db.collection('punishmentData').find({ guildId: longGuildId, userId: longUserId }).toArray();
}

async function deletePunishment(punishmentId) {
  try {
    await db.collection('punishmentData').deleteOne({ _id: punishmentId });
    return (true)
  }
  catch (error) {
    console.error(`Error deleting punishment ${punishmentId} from the database:`, error);
    return (false)
  }
}

async function getPunishment(punishmentId) {
  return await db.collection('punishmentData').findOne({ _id: punishmentId });
}

async function getUserXP(guildID, userID) {
  const longGuildId = Long.fromString(guildID);
  const guild = await db.collection('guildLevels').findOne({ _id: longGuildId });
  return guild?.levels[userID] || 0;
}

async function addUserXP(guildID, userID, xpGain) {
  const longGuildId = Long.fromString(guildID);
  const guild = await db.collection('guildLevels').findOne({ _id: longGuildId });
  if (!guild) {
    await db.collection('guildLevels').insertOne({ _id: longGuildId, levels: { [userID]: xpGain } });
  } else {
    guild.levels[userID] = (guild.levels[userID] || 0) + xpGain;
    await db.collection('guildLevels').updateOne({ _id: longGuildId }, { $set: { levels: guild.levels } });
  }
}

async function getGuildXpData(guildID) {
  const longGuildId = Long.fromString(guildID);
  return await db.collection('guildLevels').findOne({ _id: longGuildId });
}

async function getUserLevel(guildID, userID) {
  const xp = await getUserXP(guildID, userID);
  let baseXP = 100; // XP required for the first level
  let factor = 1.15; // Each level requires 15% more XP than the previous level

  // If the user's XP is less than 100, they are level 0
  if (xp < 100) {
    return 0;
  }

  // Calculate the total XP required for each level
  let totalXPForLevels = [];
  for (let level = 1; level <= 100; level++) {
    let totalXP = baseXP * Math.pow(level, factor);
    totalXPForLevels.push(Math.round(totalXP));
  }

  // Find the user's level based on their XP
  let level = totalXPForLevels.findIndex(levelXP => levelXP > xp) + 1;

  return level;
}

async function getUserGuildRank(guildID, userID) {
  const longGuildId = Long.fromString(guildID);
  const guild = await db.collection('guildLevels').findOne({ _id: longGuildId });
  const sorted = Object.entries(guild.levels).sort(([, a], [, b]) => b - a);
  const rank = sorted.findIndex(([id]) => id === userID) + 1;
  return rank;
}

function getLevelXPRequirement(level) {
  let baseXP = 100; // XP required for the first level
  let factor = 1.15; // Each level requires 15% more XP than the previous level

  // Calculate the XP required for the specified level
  let totalXP = baseXP * Math.pow(level, factor);

  return Math.round(totalXP);
}


module.exports = {
  connectDatabase,
  getDB,
  getUserXP,
  addUserXP,
  onInvite,
  wipeGuildSettings,
  getGuildSettings,
  logPunishment,
  getModLogs,
  deletePunishment,
  getPunishment,
  getGuildXpData,
  getUserLevel,
  getUserGuildRank,
  getLevelXPRequirement
}
