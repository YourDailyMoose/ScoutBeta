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

async function getUserXP(guildID, userID) {
  const guild = await client.db('guildData').collection('levels').findOne({ guildID: guildID });
  return guild?.levels[userID] || 0;
}

async function updateUserXP(guildID, userID, xpGain) {
  const guild = await client.db('guildData').collection('levels').findOne({ guildID: guildID });
  if (!guild) {
    // If guild document doesn't exist, create one with the user's XP
    await client.db('guildData').collection('levels').insertOne({ guildID: guildID, levels: { [userID]: xpGain } });
  } else {
    // Update the user's XP, or set it if the user doesn't exist in the guild document
    guild.levels[userID] = (guild.levels[userID] || 0) + xpGain;
    await client.db('guildData').collection('levels').updateOne({ guildID: guildID }, { $set: { levels: guild.levels } });
  }
}

async function onInvite(guildId) {
  // Assume 'db' is your database connection. Ensure it's properly initialized.
  const existingGuildData = await db.collection('botSettings').findOne({ _id: guildId });

  // If no document was found for the guild, insert new default settings
  if (!existingGuildData) {
    const guildData = {

      //Start JSON Data

      "_id": guildId,
      "moderationSettings": {
        "requireReason": false,
        "permissionHierarchy": true
      },
      "loggingChannels": {
        "moderation": null,
        "joinLeave": null,
        "message": null,
        "voicejoinleave": null,
        "memberChanges": null,
        "serverChanges": null
      },
      "commandPermissions": {
        "godRoles": [],
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
        }
      },
      "disabledCommands": []
      //End JSON Data
    };

    try {
      await db.collection('botSettings').insertOne(guildData);
      console.log(`Added guild ${guildId} to the database.`);
      return false; // Return false because no existing document was found
    } catch (error) {
      console.error(`Error adding guild ${guildId} to the database:`, error);
      throw error; // Throw the error to be handled by the caller
    }
  } else {
    // Return an object with a flag and the existing data
    return { found: true, data: existingGuildData };
  }
}

async function existingData(guildId) {
  const existingGuildData = await db.collection('botSettings').findOne({ _id: guildId });
  if (!existingGuildData) {
    return false;
  } else {
    return true;
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

async function getPunishment (punishmentId) {
  return await db.collection('punishmentData').findOne({ _id: punishmentId });
}


module.exports = {
  connectDatabase,
  getDB,
  getUserXP,
  updateUserXP,
  onInvite,
  wipeGuildSettings,
  existingData,
  getGuildSettings,
  logPunishment,
  getModLogs,
  deletePunishment,
  getPunishment,
}
