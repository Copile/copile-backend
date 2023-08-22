// urls.js
const fs = require('fs');
const path = require('path');

const regionsPath = path.join(__dirname, 'regions.json');
const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));

const buildURL = (exchange, userType, type) => {
    const exchangeRegion = regionsData.regions[exchange] || regionsData.regions["us-central1"];
    const typeSegment = type === "send_tp" || type === "send_sl" ? "track" : "exec";
    const regionMappings = regionsData.regions.regionMappings;
    const region = regionMappings[exchangeRegion] || "uc"; // Default to "uc" if not found

    return `https://${exchangeRegion}-${userType}-${typeSegment}-handler-zvakwy7kgq-${region}.a.run.app/${type}`;
};

module.exports = {
    buildURL
};
