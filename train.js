const app = require("express")();
const http = require("http").Server(app);

const PoweredUP = require("node-poweredup");
const poweredUP = new PoweredUP.PoweredUP();

// Imports the Google Cloud client library
const {PubSub} = require('@google-cloud/pubsub');
const { stringify } = require("querystring");

// Get config file
const config = require("./config.json");
var train = config.train;

let projectId = "next-data-hive-2023";
let topicId = "train-telemetry";
let subscriptionId = `train-actions-${train}-sub`;
const pubSubClient = new PubSub({projectId});

let run_interval = 2;
var trainState = {};
trainState.trainId = train;
var messageResponse = {};


async function publishMessage(topicNameOrId, data) {
  const dataBuffer = Buffer.from(data);

  try {
      const messageId = await pubSubClient
      .topic(topicNameOrId)
      .publishMessage({data: dataBuffer});
      console.log(`Message ${messageId} published.`);
  } catch (error) {
      console.error(`Received error while publishing: ${error.message}`);
      process.exitCode = 1;
  }
}

function listenForMessages(subscriptionNameOrId, timeout) {
  // References an existing subscription
  const subscription = pubSubClient.subscription(subscriptionNameOrId);

  // Create an event handler to handle messages
  let messageCount = 0;

  const messageHandler = message => {
    console.log(`Received message ${message.id}:`);

    messageCount += 1;

    messageData = JSON.parse(message.data);

    
    messageResponse = {
      "messageId" : message.id,
      "train" : message.attributes.train,
      "state" : messageData.state,
      "value" : messageData.value
    };

    console.log(`${JSON.stringify(messageResponse)}`);

    // "Ack" (acknowledge receipt of) the message
    message.ack();

  };

  // Listen for new messages until timeout is hit
  subscription.on('message', messageHandler);

  return messageResponse
}
// Connect to the Duplo train base
poweredUP.on("discover", async (hub) => {
    console.log("Train connected");
    
    await hub.connect();
    if (hub instanceof PoweredUP.DuploTrainBase) {
      const train = hub;

      let motor = await train.waitForDeviceByType(
        PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_MOTOR
      );

      let sounds = await train.waitForDeviceByType(
        PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_SPEAKER
      );

      setInterval(async () => {
        listenForMessages(subscriptionId, 1000);
        if ("state" in messageResponse) {
          if ("speed" === messageResponse.state) {
            console.log('change speed');
            trainState.speed = messageResponse.value ?? 0;
            motor.setPower(messageResponse.value ?? 0);
          }
          else if ("sound" === messageResponse.state) {
            console.log('play sound');
            console.log(messageResponse.value);
            sounds.playSound(messageResponse.value);
            trainState.sound = messageResponse.value
          }
          else {
            console.log('Unknown Action, resend to spec');
          }
        }
        motor.setPower(parseInt(trainState.speed) ?? 0);
        trainState.batteryLevel = hub.batteryLevel;
        trainState.changeMessage = messageResponse.messageId;
        console.log(trainState)
        publishMessage(topicId, JSON.stringify(trainState));

        delete messageResponse.state;
        delete messageResponse.value;
        delete messageResponse.messageId;
        delete trainState.sound;
        delete trainState.changeMessage;
      }, run_interval * 1000);
    }
  });

poweredUP.scan();
