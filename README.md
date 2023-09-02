# trains
## Setting up Google Cloud project

1.  Clone the repository
1.  Set up a Google Cloud project
1.  Deploy the terraform in `/infra` to the project
1.  Get the service account key json for the Pi service account

## Setting up your Pi
Your Pi needs to have Node and npm installed.

1.  Clone the repository to your Pi.
1.  Copy the Service Account key to the Pi
1.  Edit the `src/pi-controller/start.sh` file so the key location matches for your Pi.
1.  To run on the Pi, use `sudo sh start.sh`. Pi requires that you have sudo access
    to the board in order for the code to access Bluetooth
1.  Turn on the train, it should connect automatically!

## Using BigQuery with your train

1.  Open Google Cloud console and navigate to BigQuery.
1.  To test a set of functions after the train is completed, run `CALL train_telemetry.run_the_train(trainX);`
    where `trainX` is the train you have (typically train1 unless you have multiple 
    connected to the same controller).
1.  Open the `telemetry_data` table to see real time state changes from the train.

## Credits
Thanks to Nathan Kellenicki(@nathankellenicki) and his fleet of supporters building the PoweredUp package.
(https://github.com/nathankellenicki/node-poweredup)