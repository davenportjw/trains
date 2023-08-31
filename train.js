const PoweredUP = require("node-poweredup");
const poweredUP = new PoweredUP.PoweredUP();
poweredUP.scan();

const {PubSub} = require('@google-cloud/pubsub');

let projectId = "next-data-hive-2023";
let topicId = "train-telemetry";
const pubSubClient = new PubSub({projectId});

async function publishMessage(topicNameOrId, data) {
  const dataBuffer = Buffer.from(data);

  try {
      const messageId = await pubSubClient
      .topic(topicNameOrId)
      .publishMessage({data: dataBuffer});
  } catch (error) {
      console.error(`Received error while publishing: ${error.message}`);
      process.exitCode = 1;
  }
}

function listenForMessages(timeout) {
  let subscriptionId = `train-actions-sub`;
  const subscription = pubSubClient.subscription(subscriptionId);
  
  let messageCount = 0;
  let messageResponse = {};

  const messageHandler = message => {
    messageCount += 1;
    messageData = JSON.parse(message.data);

    messageResponse = {
      "Id" : message.id,
      "train" : message.attributes.train,
      "state" : messageData.state,
      "value" : messageData.value
    };
    message.ack();

    messages.push(messageResponse);
    // console.log(`${JSON.stringify(messageResponse)}`);


  };

  // Listen for new messages until timeout is hit
  subscription.on('message', messageHandler);

  return messageResponse
}

// Connect to the Duplo train base
console.log("PoweredUp. Ready to connect to trains.")
poweredUP.on("discover", async (hub) => {
    await hub.connect(); // Connect to hub
    console.log(`Connected to ${hub.name}!`);

    hub.on("disconnect", () => {
        console.log("Hub disconnected");
    })
    
    // if (hub.uuid === "e5a528f72a8c2aa5db6e41b4ac3b5df7") {
    //   color.setColor(8)
    // }
    // else {
    //   color.setColor(9)
    // }

});

var messages = [];
// Run commands on the train from Pub/Sub
setInterval(async () => {
  const hubs = poweredUP.getHubs(); // Get an array of all connected hubs
  listenForMessages(1000);
  if (hubs && hubs.length) {
    messages.forEach(function (message) {
        hubs.forEach(async (hub) => {
          let trainState = {};
          if (hub instanceof PoweredUP.DuploTrainBase) {
            
            let motor = await hub.waitForDeviceByType(
              PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_MOTOR
            );

            let sounds = await hub.waitForDeviceByType(
              PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_SPEAKER
            );

            let color = await hub.waitForDeviceByType(
              PoweredUP.Consts.DeviceType.HUB_LED
            );

            if (hub.uuid === "e5a528f72a8c2aa5db6e41b4ac3b5df7") {
              trainState.trainId = "train1";
            }
            else {
              trainState.trainId = "train2";
            }

            trainState.batteryLevel = hub.batteryLevel;
            trainState.changeMessage = message.Id;
            
            if (message.train === trainState.trainId) {
              if ("speed" === message.state) {
                trainState.speed = message.value ?? 0;
                motor.setPower(trainState.speed );
              }
              else if ("sound" === message.state) {
                sounds.playSound(message.value);
                trainState.sound = message.value;
              }
              else if ("color" === message.state) {
                color.setColor(message.value);
                trainState.color = message.value;
              }
              else {
                console.log('Unknown Action, resend to spec');
              }
            }
          }
          // console.log(trainState);
          publishMessage(topicId, JSON.stringify(trainState));
          });
      //  }
      });
    messages = [];
    }
}, 2000);
