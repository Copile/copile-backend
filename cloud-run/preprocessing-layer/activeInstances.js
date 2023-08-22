const { MetricServiceClient } = require('@google-cloud/monitoring');

const PROJECT_ID = 'copile';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetches active instance counts by region
async function fetchActiveInstances() {
    try {
        // Initialize Google Cloud Monitoring client
        const client = new MetricServiceClient();

        // Create a request to fetch active instance count metric data
        const request = {
            name: client.projectPath(PROJECT_ID),
            filter: 'metric.type="run.googleapis.com/container/instance_count" resource.type="cloud_run_revision"',
            interval: {
                // use date from the last 5 minutes
                startTime: {
                    seconds: Date.now() / 1000 - 60 * 5, 
                },
                endTime: {
                    seconds: Date.now() / 1000 ,
                },
            },
        };

        // Fetch time series data
        const [timeSeries] = await client.listTimeSeries(request);

        // Create an object to store active instance counts by region
        const activeInstanceCountsByRegion = {};

        // Process each time series data
        let previousRegion = null;
        let previousState = null;

        timeSeries.forEach(data => {
            if (data.metric.labels.state === 'active' || data.metric.labels.state === 'idle') {
                // Extract the revision name
                const revisionName = data.resource.labels.revision_name;
                const region = revisionName.split('-').slice(0, 2).join('-');

                // Check if the current region and previous region are the same
                if (region === previousRegion && data.metric.labels.state === 'idle' && previousState === 'active') {
                    // Decrease the active instance count for the region
                    activeInstanceCountsByRegion[region] = (activeInstanceCountsByRegion[region] || 1) - 1;
                } else if (data.metric.labels.state === 'active') {
                    // Increment the active instance count for the region
                    activeInstanceCountsByRegion[region] = (activeInstanceCountsByRegion[region] || 0) + 1;
                }

                previousRegion = region;
                previousState = data.metric.labels.state;
            }
        });

        console.log("Active Cloud Run instances:");
        console.log(activeInstanceCountsByRegion);

        return activeInstanceCountsByRegion;
    } catch (error) {
        // Handle errors and return an empty object
        console.error('Error fetching instance data:', error.message);
        return {};
    }
}

// Export the fetchActiveInstances function to be used by other modules
module.exports = {
    fetchActiveInstances
};
