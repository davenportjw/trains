const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const port = process.env.PORT || 3000;

const PoweredUP = require("node-poweredup");
const poweredUP = new PoweredUP.PoweredUP();
const TRAIN_LED_COLOR = PoweredUP.Consts.Color.P;

// Imports the Google Cloud client library
const {PubSub} = require('@google-cloud/pubsub');
const { stringify } = require("querystring");

let projectId = "next-data-hive-2023";
let topicId = "train-telemetry";
let subscriptionId = "train-actions-sub";
const pubSubClient = new PubSub({projectId});
var messageResponse = {};
let run_interval = 2;


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
    console.log(`\tData: ${message.data}`);
    console.log(`\tAttributes: ${message.attributes}`);

    messageCount += 1;

    messageData = JSON.parse(message.data);

    messageResponse = {
      "messageId" : message.id,
      "state" : messageData.state,
      "speed" : messageData.value
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
        console.log(messageResponse);
        console.log(`Battery Remaining: ${hub.batteryLevel}`);
        console.log(`Speed: ${parseInt(messageResponse.speed ?? 0)}`);
        // TODO: set the right publish actions
        motor.setPower(messageResponse.speed ?? 0);
        sounds.playSound(10);
        publishMessage(topicId, JSON.stringify(messageResponse));
      }, run_interval * 1000);
    }
  });

poweredUP.scan();

// DuploTrainBaseSound
// PROPERTIES:
// Name	Type	Description
// BRAKE	number	
// 3

// STATION_DEPARTURE	number	
// 5

// WATER_REFILL	number	
// 7

// HORN	number	
// 9

// STEAM	number	
// 10

