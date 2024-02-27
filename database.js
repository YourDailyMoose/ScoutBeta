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

async function setupServerdata(guildId) {
  // Assume 'db' is your database connection. Ensure it's properly initialized.
  const existingGuildData = await db.collection('botSettings').findOne({ _id: guildId });

  // If no document was found for the guild, insert new default settings
  if (!existingGuildData) {
    const guildData = {

      "_id": {
        "$numberLong": `${guildId}`
      },
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
          "channelId": null,
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
          "channelId": null,
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
          "enabled": true,
          "levelRoles": [],
          "levelMessages": []
        },
        "logging": {
          "enabled": false,
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

    const levelData = {
      "_id": Long.fromString(guildId),
      "levels": {}
    }

    try {
      await db.collection('botSettings').insertOne(guildData);

      await db.collection('guildLevels').insertOne(levelData);
      return;

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

    return false; // Return false because no existing document was found
  } catch (error) {

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
  let guild = await db.collection('guildLevels').findOne({ _id: longGuildId });



  // If the user isn't in the guild's levels, add the user with 0 XP
  if (!(userID in guild.levels)) {

    await addUserXP(guildID, userID, 0);
    guild = await db.collection('guildLevels').findOne({ _id: longGuildId }); // Get the updated guild document
  }



  return guild.levels[userID];
}

async function addUserXP(guildID, userID, xpGain) {
  const longGuildId = Long.fromString(guildID);
  const guild = await db.collection('guildLevels').findOne({ _id: longGuildId });



  if (!(userID in guild.levels)) {
    // If the user isn't in the guild's levels, add the user with xpGain XP

    guild.levels[userID] = xpGain;
    await db.collection('guildLevels').updateOne({ _id: longGuildId }, { $set: { levels: guild.levels } });
  } else {
    // If the user is in the guild's levels, increase their XP by xpGain

    guild.levels[userID] += xpGain;
    await db.collection('guildLevels').updateOne({ _id: longGuildId }, { $set: { levels: guild.levels } });
  }

  const updatedGuild = await db.collection('guildLevels').findOne({ _id: longGuildId });

}

async function getGuildXpData(guildID) {
  const longGuildId = Long.fromString(guildID);
  return await db.collection('guildLevels').findOne({ _id: longGuildId });
}

async function getUserLevel(guildID, userID) {
  const userXP = await getUserXP(guildID, userID); // Fetch the user's current XP
  let level = 1; // Start checking from level 1
  let totalXP = 0; // Initialize total XP needed to reach the current checking level

  while (true) {
    let xpForNextLevel = 5 * Math.pow(level, 2) + 50 * level + 100; // XP needed to reach the next level from the current level
    totalXP += xpForNextLevel; // Add XP for the next level to the total XP
    if (userXP < totalXP) {
      // If user's XP is less than total XP needed to reach the next level, the current level is the user's level
      break;
    }
    level++; // Move to the next level
  }

  return level; // Return the determined level
}






async function getUserGuildRank(guildID, userID) {
  const longGuildId = Long.fromString(guildID);
  const guild = await db.collection('guildLevels').findOne({ _id: longGuildId });
  const sorted = Object.entries(guild.levels).sort(([, a], [, b]) => b - a);
  const rank = sorted.findIndex(([id]) => id === userID) + 1;
  return rank;
}

function getLevelXPRequirement(level) {
  let totalXP = 0; // Initialize total XP needed to reach the specified level

  for (let l = 1; l < level; l++) { // Start from level 1 up to the level just before the specified level
    totalXP += 5 * Math.pow(l, 2) + 50 * l + 100; // Sum up the XP needed for each level
  }

  return totalXP; // Return the total XP needed to reach the specified level
}


module.exports = {
  connectDatabase,
  getDB,
  getUserXP,
  addUserXP,
  setupServerdata,
  wipeGuildSettings,
  getGuildSettings,
  logPunishment,
  getModLogs,
  deletePunishment,
  getPunishment,
  getGuildXpData,
  getUserLevel,
  getUserGuildRank,
  getLevelXPRequirement,

}
