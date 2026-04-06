'use strict';
const axios = require("axios");

// In-memory log of last N SFMC calls (for debugging)
var debugLog = [];
function logCall(route, req) {
    debugLog.push({
        route: route,
        method: req.method,
        headers: req.headers,
        body: req.body,
        timestamp: new Date().toISOString()
    });
    if (debugLog.length > 20) debugLog.shift();
}

exports.debugLog = function (req, res) {
    res.status(200).json(debugLog);
};

/*
 * POST Handlers for various routes
 */
exports.edit = function (req, res) {
    logCall('edit', req);
    res.status(200).json({ success: true });
};

exports.save = async function (req, res) {
    logCall('save', req);
    try {
        const payload = req.body;
        await saveToDatabase(payload);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ success: false, error: 'Error saving data' });
    }
};

exports.execute = async function (req, res) {
    logCall('execute', req);
    try {
        console.log('=== Execute called ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const args = (req.body && req.body.inArguments && req.body.inArguments[0]) ? req.body.inArguments[0] : {};

        const endpointUrl = (args.endpointUrl || process.env.ENDPOINT_URL || '').trim();
        const fieldMappings = (args.fieldMappings && typeof args.fieldMappings === 'object') ? args.fieldMappings : {};

        // Extract selected journey context fields (resolved by Journey Builder at runtime)
        const journeyContext = (args.journeyContext && typeof args.journeyContext === 'object') ? args.journeyContext : {};

        console.log('Endpoint URL:', endpointUrl);
        console.log('Field Mappings:', JSON.stringify(fieldMappings, null, 2));
        console.log('Journey Context:', JSON.stringify(journeyContext, null, 2));

        if (!endpointUrl) {
            console.error('Execute error: missing endpointUrl (set in UI or env ENDPOINT_URL)');
            return res.status(200).json({ success: false, error: 'Missing endpointUrl' });
        }
        
        if (Object.keys(fieldMappings).length === 0) {
            console.error('Execute error: no fields selected');
            return res.status(200).json({ success: false, error: 'No fields selected' });
        }

        // Merge field mappings with selected journey context and send to endpoint
        const endpointPayload = Object.assign({}, fieldMappings, journeyContext);
        await postToEndpoint(endpointUrl, endpointPayload);

        console.log(`Successfully posted data to endpoint: ${endpointUrl}`);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error during endpoint POST execution:', error.response ? error.response.data : error.message);
        return res.status(200).json({ success: false }); // Do not stop the journey
    }
};


exports.publish = function (req, res) {
    logCall('publish', req);
    console.log('=== Publish called ===');
    res.status(200).json({ success: true });
};

exports.validate = function (req, res) {
    logCall('validate', req);
    console.log('=== Validate called ===');
    console.log('Validate body:', JSON.stringify(req.body, null, 2));
    res.status(200).json({ success: true });
};

exports.stop = function (req, res) {
    logCall('stop', req);
    res.status(200).json({ success: true });
};

/*
 * Test endpoint connectivity from the UI
 */
exports.testEndpoint = async function (req, res) {
    try {
        const endpointUrl = (req.body && req.body.endpointUrl || '').trim();
        if (!endpointUrl) {
            return res.status(400).json({ success: false, error: 'Missing endpointUrl' });
        }

        // Build a test payload using the selected field names with sample values
        const fields = (req.body.fields && Array.isArray(req.body.fields)) ? req.body.fields : [];
        const testPayload = {};
        fields.forEach(function (field) {
            testPayload[field] = 'test_' + field;
        });

        // Fallback if no fields selected
        if (Object.keys(testPayload).length === 0) {
            testPayload.test = true;
            testPayload.timestamp = new Date().toISOString();
        }

        console.log('Test endpoint payload:', JSON.stringify(testPayload, null, 2));

        const response = await axios.post(endpointUrl, testPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        return res.status(200).json({ success: true, status: response.status, response: response.data });
    } catch (error) {
        const msg = error.response
            ? `${error.response.status} - ${JSON.stringify(error.response.data)}`
            : error.message;
        return res.status(200).json({ success: false, error: msg });
    }
};

/*
 * Function to POST data to an external endpoint
 */
async function postToEndpoint(endpointUrl, fieldMappings) {
    console.log('Posting to endpoint:', endpointUrl);
    console.log('Payload:', JSON.stringify(fieldMappings, null, 2));

    const response = await axios.post(endpointUrl, fieldMappings, {
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 10000
    });

    console.log('Endpoint response status:', response.status);
    console.log('Endpoint response data:', JSON.stringify(response.data, null, 2));
    return response.data;
}

/*
 * GET Handler for /journeys route
 */
exports.getJourneys = async function (req, res) {
    res.status(404).json({ error: 'Not implemented in DE copy mode' });
}

/*
 * Function to retrieve journeys
 */
async function fetchJourneys() {
    throw new Error('Not implemented');
}

/*
 * Handler to get activity data by UUID
 */
exports.getActivityByUUID = async function (req, res) {
    res.status(404).send('Not implemented in DE copy mode');
}


/*
 * Function to save data to the database
 */
async function saveToDatabase() {
    return;
}
